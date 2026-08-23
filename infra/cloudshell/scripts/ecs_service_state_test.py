#!/usr/bin/env python3
import unittest

from ecs_service_state import classify_payload, classify_service, worst_kind


def service(**kwargs):
    base = {
        "serviceName": "gwg-staging-web",
        "runningCount": 1,
        "desiredCount": 1,
        "pendingCount": 0,
        "deployments": [{"status": "PRIMARY", "rolloutState": "COMPLETED"}],
    }
    base.update(kwargs)
    return base


class ClassifyServiceTest(unittest.TestCase):
    def test_stable(self):
        kind, _ = classify_service(service(), "gwg-staging-web")
        self.assertEqual(kind, "stable")

    def test_missing_is_stuck(self):
        kind, detail = classify_service(None, "gwg-staging-web")
        self.assertEqual(kind, "stuck")
        self.assertEqual(detail, "missing")

    def test_in_progress_is_rolling(self):
        kind, _ = classify_service(
            service(
                pendingCount=1,
                runningCount=1,
                deployments=[
                    {"status": "PRIMARY", "rolloutState": "IN_PROGRESS"},
                    {"status": "ACTIVE", "rolloutState": "IN_PROGRESS"},
                ],
            ),
            "gwg-staging-web",
        )
        self.assertEqual(kind, "rolling")

    def test_failed_rollout_is_stuck(self):
        kind, _ = classify_service(
            service(deployments=[{"status": "PRIMARY", "rolloutState": "FAILED"}]),
            "gwg-staging-web",
        )
        self.assertEqual(kind, "stuck")

    def test_running_behind_desired_without_pending_is_stuck(self):
        kind, _ = classify_service(service(runningCount=0, desiredCount=1), "gwg-staging-web")
        self.assertEqual(kind, "stuck")


class AggregateTest(unittest.TestCase):
    def test_worst_kind(self):
        self.assertEqual(worst_kind(["stable", "stable"]), "stable")
        self.assertEqual(worst_kind(["stable", "rolling"]), "rolling")
        self.assertEqual(worst_kind(["rolling", "stuck"]), "stuck")

    def test_payload_uses_requested_names(self):
        data = {
            "services": [
                service(serviceName="gwg-staging-web"),
                service(
                    serviceName="gwg-staging-api",
                    pendingCount=1,
                    deployments=[{"status": "PRIMARY", "rolloutState": "IN_PROGRESS"}],
                ),
            ]
        }
        rows = classify_payload(data, ["gwg-staging-web", "gwg-staging-api"])
        self.assertEqual([kind for _, kind, _ in rows], ["stable", "rolling"])
        self.assertEqual(worst_kind(kind for _, kind, _ in rows), "rolling")


if __name__ == "__main__":
    unittest.main()
