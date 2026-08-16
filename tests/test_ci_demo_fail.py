"""CI red-path demo (2026-08-16): this test intentionally fails.

Pushed to main to demonstrate that the deploy watcher refuses to deploy a
commit whose GitHub Actions checks are red. Removed by the revert commit.
"""


def test_demo_red_path_intentional_failure():
    assert False, "intentional CI failure for the red-path demo"
