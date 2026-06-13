"""One-off: open /settings, screenshot, exercise Mode + Kill-Switch, report console + network."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

# Nginx proxies exact path /settings to the API (JSON). SPA Settings UI: open / then client-navigate.
ORIGIN = "http://127.0.0.1:8080"
OUT = Path(__file__).resolve().parent.parent / "docs" / "screenshots" / "settings-audit.png"


def main() -> int:
    console_errors: list[dict] = []
    failed_network: list[dict] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        def on_console(msg) -> None:
            if msg.type == "error":
                loc = msg.location
                console_errors.append(
                    {
                        "type": msg.type,
                        "text": msg.text,
                        "location": {"url": loc.get("url"), "line": loc.get("lineNumber")},
                    }
                )

        def on_page_error(err) -> None:
            console_errors.append({"type": "pageerror", "text": str(err)})

        def on_request_failed(request) -> None:
            fail = request.failure
            et = fail.error_text if fail else None
            failed_network.append(
                {
                    "kind": "requestfailed",
                    "method": request.method,
                    "url": request.url,
                    "failure": et,
                }
            )

        def on_response(response) -> None:
            if response.status >= 400:
                failed_network.append(
                    {
                        "kind": "http_error",
                        "method": response.request.method,
                        "url": response.url,
                        "status": response.status,
                    }
                )

        page.on("console", on_console)
        page.on("pageerror", on_page_error)
        page.on("requestfailed", on_request_failed)
        page.on("response", on_response)

        try:
            page.goto(f"{ORIGIN}/", wait_until="networkidle", timeout=60_000)
        except Exception as e:
            print(json.dumps({"fatal": str(e)}, indent=2))
            browser.close()
            return 1

        page.get_by_role("link", name="Settings").click()
        page.wait_for_url("**/settings")
        page.wait_for_timeout(500)

        OUT.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(OUT), full_page=True)

        mode_btn = page.get_by_role("button", name=re.compile(r"Zu (Autopilot|Guardian) wechseln"))
        mode_btn.click()
        page.get_by_role("button", name="Bestaetigen").click()
        page.wait_for_timeout(800)

        mode_btn.click()
        page.get_by_role("button", name="Bestaetigen").click()
        page.wait_for_timeout(800)

        page.get_by_role("button", name="Kill-Switch aktivieren").click()
        dlg = page.get_by_role("dialog", name="kill-switch-confirm")
        dlg.get_by_label("kill-switch-confirm-input").fill("KILL SWITCH")
        dlg.get_by_role("button", name="Aktivieren", exact=True).click()
        page.wait_for_timeout(800)

        page.get_by_role("button", name="Kill-Switch deaktivieren").click()
        dlg2 = page.get_by_role("dialog", name="kill-switch-confirm")
        dlg2.get_by_label("kill-switch-confirm-input").fill("KILL SWITCH")
        dlg2.get_by_role("button", name="Deaktivieren", exact=True).click()
        page.wait_for_timeout(800)

        browser.close()

    report = {
        "note": (
            "Direkt http://127.0.0.1:8080/settings ist bei Nginx die Settings-API (JSON), nicht die SPA. "
            "Audit: zuerst / geoeffnet, dann Link Settings."
        ),
        "screenshot": str(OUT),
        "consoleErrors": console_errors,
        "failedNetwork": failed_network,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
