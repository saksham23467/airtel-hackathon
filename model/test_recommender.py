import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import recommender as reco


def test_gstin_checksum_vectors():
    assert reco.gstin_checksum_ok("37NBLXS1145E1ZU")
    assert reco.gstin_checksum_ok("37IHKXV5167L1ZS")
    assert reco.gstin_checksum_ok("27XUIXG0767D1ZP")
    assert not reco.gstin_checksum_ok("08YKZXS8189L1Z0")
    assert not reco.gstin_checksum_ok("37THKXV5167L1ZS")
    assert not reco.gstin_checksum_ok("19E0GXH4115Y1ZL")


def test_active_registry_not_the_flag():
    registry = reco.load_registry(reco.DATA / "mock_gstin_registry.csv")
    assert reco.gst_is_active("37NBLXS1145E1ZU", registry)
    assert not reco.gst_is_active("37IHKXV5167L1ZS", registry)
    assert registry["37IHKXV5167L1ZS"]["status"] == "Cancelled"


def test_cancelled_gstin_blocks_gst_products():
    products = reco.load_catalogue()
    registry = reco.load_registry(reco.DATA / "mock_gstin_registry.csv")
    blocked = reco.Profile("micro", 2, 4, 1, 0, 1, 0, 1, 1800, "Mobile hotspot")
    assert blocked.gst_active == 0
    eligible = set(reco.eligible_ids(blocked, products))
    assert "P14" not in eligible
    assert "P01" in eligible
    active = reco.Profile(
        "micro",
        2,
        4,
        1,
        0,
        1,
        int(reco.gst_is_active("37NBLXS1145E1ZU", registry)),
        1,
        1800,
        "Mobile hotspot",
    )
    assert "P14" in set(reco.eligible_ids(active, products))
    assert "P03" not in set(reco.eligible_ids(active, products))


def test_manufacturer_size_gates():
    products = reco.load_catalogue()
    registry = reco.load_registry(reco.DATA / "mock_gstin_registry.csv")
    profile = reco.Profile(
        "mfg",
        2,
        18,
        1,
        1,
        1,
        int(reco.gst_is_active("27XUIXG0767D1ZP", registry)),
        1,
        7000,
        "Business broadband",
    )
    eligible = set(reco.eligible_ids(profile, products))
    assert "P05" in eligible
    assert "P06" not in eligible
    assert "P03" not in eligible


def test_assemble_inserts_base_before_dependent():
    deps = {"P22": {"P01", "P02", "P04"}, "P19": set(), "P18": set(), "P07": set(), "P01": set()}
    ranked = ["P22", "P19", "P18", "P07", "P01"]
    assert reco.assemble(ranked, deps, 3) == ["P01", "P22", "P19"]
    assert reco.assemble(ranked, deps, 1) == ["P19"]


def test_assemble_is_recursive_and_budgets_slots():
    deps = {"C": {"A", "B"}, "D": {"C"}, "A": set(), "B": set()}
    ranked = ["D", "C", "B", "A"]
    assert reco.assemble(ranked, deps, 3) == ["B", "C", "D"]
    assert reco.assemble(ranked, deps, 2) == ["B", "C"]
    assert reco.assemble(ranked, deps, 4) == ["B", "C", "D", "A"]


def test_slot_budgets_are_assembled_separately():
    deps = {"P22": {"P01"}, "P19": set(), "P18": set(), "P01": set()}
    ranked = ["P22", "P19", "P18", "P01"]
    assert reco.assemble(ranked, deps, 1) == ["P19"]
    assert reco.assemble(ranked, deps, 3) == ["P01", "P22", "P19"]
    assert reco.assemble(ranked, deps, 3)[:1] != reco.assemble(ranked, deps, 1)


def test_historical_purchase_audit_counts():
    products = reco.load_catalogue()
    leads = reco.read_csv(reco.DATA / "smb_leads.csv")
    registry = reco.load_registry(reco.DATA / "mock_gstin_registry.csv")
    audit = reco.audit_historical_purchases(leads, products, registry)
    assert audit == {
        "lines": 1651,
        "profile": 40,
        "dependency_only": 9,
        "union_profile_or_dependency": 49,
        "additional_inactive_registry": 9,
    }


def test_case_funnel_counts():
    leads = reco.read_csv(reco.DATA / "smb_leads.csv")
    funnel = reco.funnel_from_leads(leads)
    counts = [stage["leads"] for stage in funnel["stages"]]
    assert counts == [5000, 3406, 1974, 861, 588, 368]
    assert funnel["activation_with_gstin_flag"]["activated"] == 338
    assert funnel["activation_with_gstin_flag"]["leads"] == 3534
    assert funnel["activation_without_gstin_flag"]["activated"] == 30
    assert funnel["activation_without_gstin_flag"]["leads"] == 1466
    assert round(funnel["mean_days_lead_to_activation"], 1) == 17.6
    assert funnel["median_monthly_bundle_inr"] == 6900
    assert round(funnel["blended_acquisition_cost_per_activation_inr"], 2) == 15053.37


def test_this_run_metrics_file():
    path = Path(__file__).resolve().parents[1] / "model" / "artifacts" / "metrics.json"
    metrics = json.loads(path.read_text())
    assert metrics["assembled"]["gbm"]["3"]["violations"] == 0
    assert metrics["assembled"]["gbm"]["5"]["violations"] == 0
    assert metrics["assembled"]["gbm"]["3"]["mean_products"] == 3
    assert abs(metrics["assembled"]["gbm"]["3"]["precision"] - 0.707427536231884) < 1e-12
    assert abs(metrics["assembled"]["pop_segment"]["3"]["precision"] - 0.683876811594203) < 1e-12
    assert metrics["versions"]["sklearn"] == "1.9.1"
