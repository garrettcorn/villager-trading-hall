#!/usr/bin/env python3
"""End-to-end smoke test for the Villager Trading Hall tracker.

Boots the app in a headless browser and exercises the full flow:
create hall, add villager, add item + enchanted-book trades, verify the
Books page and the Discounts calculator, then export/import JSON.

Usage: python3 tests/smoke_test.py [base_url]
Default base URL: http://localhost:8791/index.html
Requires: pip install playwright && python -m playwright install chromium
"""
import json
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8791/index.html"

checks = []


def check(label, cond, detail=""):
    checks.append((label, bool(cond), detail))
    print(("ok   " if cond else "FAIL ") + label + ("  [" + detail + "]" if detail and not cond else ""))


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE)
        page.wait_for_timeout(400)

        # --- create hall ---
        page.get_by_text("Create your first hall").click()
        check("hall modal opens", page.locator("#f-hall-name").is_visible())
        page.locator("#f-hall-name").fill("Main Hall")
        page.locator("#f-hall-version").select_option("java")
        page.get_by_role("button", name="Create", exact=True).click()
        page.wait_for_timeout(300)
        check("hall created", page.get_by_role("button", name="Version: Java Edition").is_visible())

        # --- add villager ---
        page.get_by_role("button", name="Add Villager").click()
        page.locator("#f-name").fill("Mending Bob")
        page.locator("#f-prof").select_option("librarian")
        page.locator("#f-level").select_option("2")
        page.locator("#f-stall").fill("3")
        page.locator("#f-position").fill("west wall")
        page.locator("#f-cured").check()
        page.locator("#f-notes").fill("Best mending seller")
        page.get_by_role("button", name="Add", exact=True).click()
        page.wait_for_timeout(300)
        check("navigated to villager detail", page.locator(".page-title").inner_text() == "Mending Bob")

        # --- add item trade (sell: diamond chestplate for 9 emeralds, mult 0.2) ---
        page.get_by_role("button", name="+ Item trade").click()
        page.locator("#tf-item").fill("Diamond Chestplate")
        page.locator("#tf-count").fill("1")
        page.locator("#tf-price2").fill("9")
        page.locator("#tf-mult").select_option("0.2")
        page.get_by_role("button", name="Add", exact=True).click()
        page.wait_for_timeout(300)
        # cured + hero0: base 9, cure -floor(0.2*20)= -4 -> 5
        check("item trade final price 5 emeralds", "5 emeralds" in page.locator(".trade-list").inner_text())

        # --- add enchanted book trade (Mending I, 8 emeralds, mult 0.3) ---
        page.get_by_role("button", name="+ Enchanted book").click()
        page.locator("#tf-enchant").fill("Mending")
        page.locator("#tf-level").select_option("1")
        page.locator("#tf-price").fill("8")
        page.get_by_role("button", name="Add", exact=True).click()
        page.wait_for_timeout(300)
        # cured + hero0: base 8, cure -floor(0.3*20)= -6 -> 2
        text = page.locator(".trade-list").inner_text()
        check("book trade shows Mending 1", "Mending 1" in text)
        check("book trade final price 2 emeralds", "2 emeralds" in text)

        # --- books page ---
        page.locator('.nav-tab[data-route="books"]').click()
        page.wait_for_timeout(300)
        book_text = page.locator("body").inner_text()
        check("books collection shows Mending 1", "Mending 1" in book_text)
        check("books reference lists Sharpness", "Sharpness" in book_text)
        check("enchantment count listed", "Enchantment reference (42)" in book_text)

        # --- discounts page + calculator ---
        page.locator('.nav-tab[data-route="discounts"]').click()
        page.wait_for_timeout(300)
        page.locator("#c-base").fill("14")
        page.locator("#c-hero").select_option("3")
        out = page.locator("#calc-out").inner_text()
        check("wiki example hero III: 14 -> 9", "9" in out and "Final price" in out)
        page.locator("#c-mult").select_option("0.2")
        page.locator("#c-cured").check()
        page.locator("#c-hero").select_option("0")
        out = page.locator("#calc-out").inner_text()
        # mult 0.2, cured: 14 - floor(0.2*20)= -4 -> 10
        check("cure discount: 14 -> 10", "10" in out)

        # --- data page: export -> erase -> import ---
        page.locator('.nav-tab[data-route="data"]').click()
        page.wait_for_timeout(300)
        with page.expect_download() as dl_info:
            page.get_by_role("button", name="Export JSON").click()
        download = dl_info.value
        backup = json.loads(download.path().read_text())
        check("export is valid JSON with halls", "Main Hall" in json.dumps(backup))

        page.get_by_role("button", name="Erase all data").click()
        page.get_by_role("button", name="Erase everything").click()
        page.wait_for_timeout(300)
        check("data erased", "No halls yet" in page.locator("body").inner_text())

        page.locator('.nav-tab[data-route="data"]').click()
        page.locator("#paste-json").fill(json.dumps(backup))
        page.get_by_role("button", name="Import pasted JSON").click()
        page.wait_for_timeout(300)
        page.locator('.nav-tab[data-route="hall"]').click()
        page.wait_for_timeout(300)
        check("import restores hall", "Main Hall" in page.locator("body").inner_text())

        check("no page errors", not errors, "; ".join(errors))
        browser.close()

    failed = [c for c in checks if not c[1]]
    print("\n%d passed, %d failed" % (len(checks) - len(failed), len(failed)))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
