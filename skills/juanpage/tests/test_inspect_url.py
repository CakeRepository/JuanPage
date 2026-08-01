from __future__ import annotations
import base64, gzip, json, importlib.util, unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "inspect_url.py"
SPEC = importlib.util.spec_from_file_location("inspect_url", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(MODULE)

def url(page):
    data = base64.urlsafe_b64encode(gzip.compress(json.dumps(page).encode())).decode().rstrip("=")
    return f"https://example.test/#v=5&enc=gz&data={data}"

class InspectUrlTests(unittest.TestCase):
    def test_reports_changes_and_activity(self):
        baseline = {"version":"2.0","title":"Launch","objects":[{"id":"launch","type":"Launch","name":"Launch","fields":[{"key":"status","label":"Status","value":"In progress"}]}],"scopes":[{"id":"workstream","label":"Focus workstream","field":"workstream","initial":None}]}
        page = json.loads(json.dumps(baseline)); page["objects"][0]["fields"][0]["value"]="Ready"; page["state"]={"scopes":{"workstream":"Marketing"}}
        page["metadata"]={"juanpager.interactionLedger":json.dumps([{"id":"1","label":"Set launch status","timestamp":"2026-08-01T00:00:00Z","patches":1}])}
        report = MODULE.inspect_url(url(page), baseline)
        self.assertEqual(report["interactionCount"], 1)
        self.assertIn({"label":"Launch · Status","before":"In progress","after":"Ready"}, report["changes"])
        self.assertIn({"label":"Focus workstream","before":None,"after":"Marketing"}, report["changes"])

    def test_warns_without_baseline(self):
        page={"version":"2.0","title":"Page","objects":[{"id":"x","type":"x","name":"X"}],"metadata":{"juanpager.interactionLedger":json.dumps([{"id":"1","label":"Set value","timestamp":"2026-08-01T00:00:00Z","patches":1}])}}
        self.assertTrue(MODULE.inspect_url(url(page))["warnings"])

if __name__ == "__main__": unittest.main()
