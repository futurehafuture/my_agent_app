from __future__ import annotations
import ast
import datetime
import operator
from typing import Any, Callable


ToolHandler = Callable[[dict[str, Any]], Any]


def get_time(_: dict[str, Any]) -> dict[str, str]:
    return {
        "now": datetime.datetime.now(datetime.UTC).isoformat()
    }


def calculator(args: dict[str, Any]) -> dict[str, Any]:
    expression = args.get("expression")

    if not isinstance(expression, str):
        raise ValueError("Missing string argument: expression")

    result = safe_eval_arithmetic(expression)

    return {
        "expression": expression,
        "result": result,
    }


def safe_eval_arithmetic(expression: str) -> int | float:
    node = ast.parse(expression, mode="eval")
    return _eval_node(node.body)


def _eval_node(node: ast.AST) -> int | float:
    binary_ops = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.FloorDiv: operator.floordiv,
        ast.Mod: operator.mod,
        ast.Pow: operator.pow,
    }

    unary_ops = {
        ast.UAdd: operator.pos,
        ast.USub: operator.neg,
    }

    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value

    if isinstance(node, ast.BinOp) and type(node.op) in binary_ops:
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        return binary_ops[type(node.op)](left, right)

    if isinstance(node, ast.UnaryOp) and type(node.op) in unary_ops:
        operand = _eval_node(node.operand)
        return unary_ops[type(node.op)](operand)

    raise ValueError("Only basic arithmetic expressions are allowed.")


TOOLS: dict[str, dict[str, Any]] = {
    "get_time": {
        "chat_schema": {
            "type": "function",
            "function": {
                "name": "get_time",
                "description": "Get the current UTC time.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
            },
        },
        "responses_schema": {
            "type": "function",
            "name": "get_time",
            "description": "Get the current UTC time.",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
        "handler": get_time,
    },
    "calculator": {
        "chat_schema": {
            "type": "function",
            "function": {
                "name": "calculator",
                "description": "Evaluate a basic arithmetic expression.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "expression": {
                            "type": "string",
                            "description": "A basic arithmetic expression, for example: 12 * 7 + 3",
                        }
                    },
                    "required": ["expression"],
                    "additionalProperties": False,
                },
            },
        },
        "responses_schema": {
            "type": "function",
            "name": "calculator",
            "description": "Evaluate a basic arithmetic expression.",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "A basic arithmetic expression, for example: 12 * 7 + 3",
                    }
                },
                "required": ["expression"],
                "additionalProperties": False,
            },
        },
        "handler": calculator,
    },
}


def run_local_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name not in TOOLS:
        return {
            "ok": False,
            "error": f"Unknown tool: {name}",
        }

    try:
        handler = TOOLS[name]["handler"]
        result = handler(arguments)

        return {
            "ok": True,
            "result": result,
        }
    except Exception as error:
        return {
            "ok": False,
            "error": str(error),
        }
