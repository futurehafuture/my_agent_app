from html import unescape
from urllib.parse import quote_plus
from urllib.request import Request, urlopen
import re


def web_search(query: str, max_results: int = 5) -> list[dict[str, str]]:
    """Simple browser-search tool using DuckDuckGo HTML.

    This avoids API keys for the MVP. Production should use a proper search provider.
    """
    url = f"https://duckduckgo.com/html/?q={quote_plus(query)}"
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 MyAgentApp/0.1"})
    try:
        with urlopen(request, timeout=12) as response:
            html = response.read().decode("utf-8", errors="replace")
    except Exception as exc:
        return [{"title": "Search failed", "url": "", "snippet": str(exc)}]

    results: list[dict[str, str]] = []
    pattern = re.compile(r'<a rel="nofollow" class="result__a" href="(?P<url>[^"]+)">(?P<title>.*?)</a>.*?<a class="result__snippet".*?>(?P<snippet>.*?)</a>', re.S)
    for match in pattern.finditer(html):
        title = _strip_html(match.group("title"))
        snippet = _strip_html(match.group("snippet"))
        results.append({"title": title, "url": unescape(match.group("url")), "snippet": snippet})
        if len(results) >= max_results:
            break
    return results or [{"title": "No results parsed", "url": url, "snippet": "The search provider returned no parseable result cards."}]


def _strip_html(value: str) -> str:
    text = re.sub(r"<.*?>", "", value)
    return unescape(re.sub(r"\s+", " ", text)).strip()
