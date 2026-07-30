import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "build_ecdict_core.py"
FIXTURE_PATH = Path(__file__).parent / "fixtures" / "ecdict-sample.csv"


def load_builder_module():
    spec = importlib.util.spec_from_file_location("build_ecdict_core", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class EcdictCoreBuildTests(unittest.TestCase):
    def test_builds_compact_core_forms_bands_and_report(self):
        builder = load_builder_module()
        with tempfile.TemporaryDirectory() as temporary_dir:
            output_dir = Path(temporary_dir)
            builder.build_core(FIXTURE_PATH, output_dir, limit=4)

            core = json.loads((output_dir / "dict-core.json").read_text(encoding="utf-8"))
            forms = json.loads((output_dir / "forms.json").read_text(encoding="utf-8"))
            bands = json.loads((output_dir / "frequency-bands.json").read_text(encoding="utf-8"))
            report = json.loads((output_dir / "build-report.json").read_text(encoding="utf-8"))

        self.assertEqual(list(core), ["alpha", "beta", "go", "wend"])
        self.assertEqual(core["go"], ["ɡəʊ", "v.", "去；走"])
        self.assertEqual(forms["went"], "go")
        self.assertEqual(forms["going"], "go")
        self.assertEqual(forms["goes"], "go")
        self.assertEqual(set(bands), set(core))
        self.assertEqual(report["eligible_count"], 4)
        self.assertEqual(report["selected_count"], 4)
        self.assertEqual(report["selection_order"], ["go", "wend", "alpha", "beta"])
        self.assertEqual(report["rejections"]["missing_phonetic"], 1)
        self.assertEqual(report["rejections"]["missing_pos"], 1)
        self.assertEqual(report["rejections"]["missing_translation"], 1)
        self.assertEqual(report["rejections"]["not_simple_lowercase_word"], 2)
        self.assertEqual(report["rejections"]["translation_too_long"], 1)
        self.assertEqual(report["form_collisions"], {"went": ["go", "wend"]})
        self.assertIn("dict-core.json", report["artifacts"])

    def test_is_deterministic_and_rejects_insufficient_eligible_records(self):
        builder = load_builder_module()
        with tempfile.TemporaryDirectory() as first_dir, tempfile.TemporaryDirectory() as second_dir:
            builder.build_core(FIXTURE_PATH, Path(first_dir), limit=4)
            builder.build_core(FIXTURE_PATH, Path(second_dir), limit=4)
            first_hashes = {
                path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                for path in sorted(Path(first_dir).iterdir())
            }
            second_hashes = {
                path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                for path in sorted(Path(second_dir).iterdir())
            }
            self.assertEqual(first_hashes, second_hashes)

            with self.assertRaisesRegex(ValueError, "eligible"):
                builder.build_core(FIXTURE_PATH, Path(second_dir), limit=5)

    def test_rejects_a_row_with_invalid_utf8_without_losing_valid_rows(self):
        builder = load_builder_module()
        csv_bytes = (
            b"word,phonetic,translation,pos,tag,bnc,frq,exchange\n"
            b"valid,va,\xe6\x9c\x89\xe6\x95\x88,n.,,1,1,\n"
            b"broken,\xff,\xe6\x8d\x9f\xe5\x9d\x8f,n.,,2,2,\n"
        )
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            input_path = root / "mixed.csv"
            input_path.write_bytes(csv_bytes)
            report = builder.build_core(input_path, root / "out", limit=1)

        self.assertEqual(report["selected_count"], 1)
        self.assertEqual(report["rejections"]["invalid_utf8_row"], 1)

    def test_ignores_invalid_utf8_in_unused_source_columns(self):
        builder = load_builder_module()
        csv_bytes = (
            b"word,phonetic,definition,translation,pos,tag,bnc,frq,exchange\n"
            b"valid,va,\xff,\xe6\x9c\x89\xe6\x95\x88,n.,,1,1,\n"
        )
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            input_path = root / "unused-invalid.csv"
            input_path.write_bytes(csv_bytes)
            report = builder.build_core(input_path, root / "out", limit=1)

        self.assertEqual(report["selected_count"], 1)
        self.assertNotIn("invalid_utf8_row", report["rejections"])

    def test_derives_pos_from_explicit_translation_prefix_when_pos_column_is_blank(self):
        builder = load_builder_module()
        csv_bytes = (
            b"word,phonetic,translation,pos,tag,bnc,frq,exchange\n"
            b"derive,di, n. \xe9\xa1\xb9\xe7\x9b\xae\\nv. \xe6\x89\xa7\xe8\xa1\x8c,, ,1,1,\n"
        )
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            input_path = root / "derive-pos.csv"
            input_path.write_bytes(csv_bytes)
            builder.build_core(input_path, root / "out", limit=1)
            core = json.loads((root / "out" / "dict-core.json").read_text(encoding="utf-8"))

        self.assertEqual(core["derive"], ["di", "n./v.", "项目；执行"])

    def test_ignores_exchange_relation_codes_that_are_not_word_forms(self):
        builder = load_builder_module()
        csv_bytes = (
            b"word,phonetic,translation,pos,tag,bnc,frq,exchange\n"
            b"come,k,vi. \xe6\x9d\xa5,, ,1,1,p:came/i:coming/3:comes/d:come/0:come/1:d\n"
        )
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            input_path = root / "exchange.csv"
            input_path.write_bytes(csv_bytes)
            builder.build_core(input_path, root / "out", limit=1)
            forms = json.loads((root / "out" / "forms.json").read_text(encoding="utf-8"))

        self.assertEqual(forms, {"came": "come", "coming": "come", "comes": "come"})

    def test_reports_quiz_eligibility_with_sufficient_distinct_translations(self):
        builder = load_builder_module()
        csv_bytes = (
            b"word,phonetic,translation,pos,tag,bnc,frq,exchange\n"
            b"a,\xe9\x94\x80,ta,n.,,1,1,\n"
            b"b,\xe9\x94\x81,tb,n.,,2,2,\n"
            b"c,\xe9\x94\x82,tc,n.,,3,3,\n"
            b"d,\xe9\x94\x83,td,n.,,4,4,\n"
        )
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            input_path = root / "quiz-ok.csv"
            input_path.write_bytes(csv_bytes)
            report = builder.build_core(input_path, root / "out", limit=4)

        eligibility = report["quiz_eligibility"]
        self.assertEqual(eligibility["distractor_count"], 3)
        self.assertEqual(eligibility["distinct_translation_count"], 4)
        self.assertEqual(eligibility["ineligible_count"], 0)
        self.assertEqual(eligibility["ineligible_words"], [])

    def test_reports_all_words_ineligible_when_too_few_distinct_translations(self):
        builder = load_builder_module()
        csv_bytes = (
            b"word,phonetic,translation,pos,tag,bnc,frq,exchange\n"
            b"a,\xe9\x94\x80,ta,n.,,1,1,\n"
            b"b,\xe9\x94\x81,tb,n.,,2,2,\n"
            b"c,\xe9\x94\x82,tc,n.,,3,3,\n"
        )
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            input_path = root / "quiz-bad.csv"
            input_path.write_bytes(csv_bytes)
            report = builder.build_core(input_path, root / "out", limit=3)

        eligibility = report["quiz_eligibility"]
        self.assertEqual(eligibility["distinct_translation_count"], 3)
        self.assertEqual(eligibility["ineligible_count"], 3)
        self.assertEqual(eligibility["ineligible_words"], ["a", "b", "c"])

    def test_drops_form_keys_that_are_also_core_headwords(self):
        # 复现真实 collision：could 既是 core 主词条，又是 can 的过去式词形（forms[could]=can）。
        # 运行时 core 优先查找会直接命中 core[could]，故 forms[could] 在构建时丢弃，
        # 且 could 作为合法 core 词条保留、不计入首测不合格。
        builder = load_builder_module()
        csv_bytes = (
            b"word,phonetic,translation,pos,tag,bnc,frq,exchange\n"
            b"can,k,\xe8\x83\xbd,v.,,1,1,p:could\n"
            b"could,kd,\xe8\x83\xbd\xef\xbc\x88\xe8\xbf\x87\xe5\x8e\xbb\xe5\xbc\x8f\xef\xbc\x89,v.,,2,2,\n"
            b"go,g,\xe5\x8e\xbb,v.,,3,3,\n"
            b"run,r,\xe8\xb7\x91,v.,,4,4,\n"
        )
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            input_path = root / "core-form.csv"
            input_path.write_bytes(csv_bytes)
            report = builder.build_core(input_path, root / "out", limit=4)
            forms = json.loads((root / "out" / "forms.json").read_text(encoding="utf-8"))

        self.assertNotIn("could", forms)
        self.assertEqual(report["core_form_collisions"], ["could"])
        eligibility = report["quiz_eligibility"]
        self.assertEqual(eligibility["ineligible_count"], 0)
        self.assertNotIn("shadowed_core_keys", eligibility)


if __name__ == "__main__":
    unittest.main()
