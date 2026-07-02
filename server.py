from __future__ import annotations
"""
WebSocket server for the Agent App UI.

Bridges the frontend to the Python agent loop, streaming events
(tool calls, tool results, assistant answers) in real time.
"""

import asyncio
import json
import os
import sys
import traceback
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure src/ is on the Python path
SRC_DIR = Path(__file__).resolve().parent / "src"
sys.path.insert(0, str(SRC_DIR))

from agent import normalize_history
from loop import SYSTEM_PROMPT, execute_tool_call
from providers import ChatCompletionsProvider, ResponsesProvider
from providers.base import Provider
from tools import TOOLS

load_dotenv()

app = FastAPI(title="Agent Workspace")

# CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)




# ---------------------------------------------------------------------------
# Streaming agent loop
# ---------------------------------------------------------------------------

def get_thinking_content(model_output: ModelOutput, iteration: int) -> str:
    """Generate professional, context-appropriate thinking description if reasoning is empty."""
    if model_output.reasoning:
        return model_output.reasoning

    if model_output.tool_calls:
        tool_names = ", ".join([f"`{tc.name}`" for tc in model_output.tool_calls])
        if iteration == 1:
            return f"Analyzing user request and selecting appropriate tools to retrieve context. Initiating tool call(s): {tool_names}."
        else:
            return f"Analyzing preceding results and deciding to execute subsequent tool call(s): {tool_names}."
    else:
        if iteration == 1:
            return "Evaluating prompt parameters and drafting response directly from base knowledge."
        else:
            return "Analyzing all retrieved tool execution logs to construct the final response."


async def run_agent_stream(
    websocket: WebSocket,
    user_input: str,
    history: list[dict[str, str]],
    model: str,
) -> str:
    """Run the agent loop and stream each event over WebSocket. Returns final answer."""

    provider = ResponsesProvider()
    state = provider.build_initial_state(
        system_prompt=SYSTEM_PROMPT,
        history=history,
        user_input=user_input,
    )
    tool_schemas = provider.build_tool_schemas(TOOLS)
    max_iterations = 16
    iteration = 0

    while True:
        iteration += 1

        # Send initial thinking indicator with index
        await send_event(websocket, "thinking", {
            "content": f"Thinking (iteration {iteration})…",
            "index": iteration - 1
        })

        # Call the model (blocking, so run in thread)
        try:
            model_output = await asyncio.to_thread(
                provider.call_model,
                model=model,
                state=state,
                tool_schemas=tool_schemas,
            )
        except Exception as e:
            if provider.api_name == "responses" and iteration == 1:
                # Silently fall back without warning message
                provider = ChatCompletionsProvider()
                tool_schemas = provider.build_tool_schemas(TOOLS)
                state = provider.build_initial_state(
                    system_prompt=SYSTEM_PROMPT,
                    history=history,
                    user_input=user_input,
                )
                try:
                    model_output = await asyncio.to_thread(
                        provider.call_model,
                        model=model,
                        state=state,
                        tool_schemas=tool_schemas,
                    )
                except Exception as retry_error:
                    await send_event(websocket, "error", {
                        "content": f"Model call failed on fallback: {retry_error}"
                    })
                    return ""
            else:
                await send_event(websocket, "error", {
                    "content": f"Model call failed: {e}"
                })
                return ""

        # Send final updated thinking content
        thinking_text = get_thinking_content(model_output, iteration)
        await send_event(websocket, "thinking_update", {
            "content": thinking_text,
            "index": iteration - 1
        })

        provider.append_model_output(state, model_output)

        # If model has text AND tool calls, send intermediate text
        if model_output.text and model_output.tool_calls:
            await send_event(websocket, "assistant", {
                "content": model_output.text
            })

        # Process tool calls
        if model_output.tool_calls:
            if iteration > max_iterations:
                await send_event(websocket, "error", {
                    "content": f"Exceeded max tool iterations ({max_iterations})"
                })
                return ""

            for tc in model_output.tool_calls:
                # Send tool_call event
                await send_event(websocket, "tool_call", {
                    "name": tc.name,
                    "arguments": tc.arguments,
                    "call_id": tc.id,
                })

                # Execute tool (blocking, in thread)
                tool_result = await asyncio.to_thread(
                    execute_tool_call, tc.name, tc.arguments
                )

                # Append to state
                provider.append_tool_result(state, tc, tool_result)

                # Send tool_result event
                status = "success" if tool_result.get("ok", False) else "error"
                await send_event(websocket, "tool_result", {
                    "name": tc.name,
                    "status": status,
                    "result": tool_result,
                })

            # Continue loop for next model call
            continue

        # No tool calls → final answer
        if model_output.text:
            await send_event(websocket, "assistant", {
                "content": model_output.text
            })

        # Send completion event
        await send_event(websocket, "done", {
            "iterations": iteration,
            "backend": provider.api_name,
        })
        return model_output.text or ""


async def send_event(websocket: WebSocket, event_type: str, data: dict[str, Any]):
    """Send a JSON event to the frontend."""
    await websocket.send_json({
        "type": event_type,
        "data": data,
    })


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

# Store per-connection conversation history
sessions: dict[int, list[dict[str, str]]] = {}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = id(websocket)
    sessions[session_id] = []

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # Send initial config
    await send_event(websocket, "config", {
        "model": model,
        "tools": list(TOOLS.keys()),
    })

    try:
        while True:
            # Wait for user message
            raw = await websocket.receive_text()

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                msg = {"content": raw}

            user_input = msg.get("content", "").strip()
            if not user_input:
                continue

            # Echo user message back (so UI confirms receipt)
            await send_event(websocket, "user_echo", {
                "content": user_input,
            })

            # Run agent with conversation history
            history = sessions[session_id]
            final_answer = ""

            try:
                final_answer = await run_agent_stream(
                    websocket=websocket,
                    user_input=user_input,
                    history=history,
                    model=model,
                )
            except Exception as e:
                traceback.print_exc()
                await send_event(websocket, "error", {
                    "content": f"Agent error: {e}",
                })

            # Save conversation turn for multi-turn context
            if final_answer:
                sessions[session_id].append(
                    {"role": "user", "content": user_input}
                )
                sessions[session_id].append(
                    {"role": "assistant", "content": final_answer}
                )

    except WebSocketDisconnect:
        sessions.pop(session_id, None)
        print(f"[ws] Client {session_id} disconnected")
    except Exception as e:
        sessions.pop(session_id, None)
        print(f"[ws] Connection error: {e}")


# Serve the UI static files at root (must be defined last to avoid intercepting websocket)
UI_DIR = Path(__file__).resolve().parent / "ui"
app.mount("/", StaticFiles(directory=str(UI_DIR), html=True), name="ui")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
