import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { loadFromSheets } = await import("../src/lib/ops/sheets-adapter");
  const snap = await loadFromSheets();
  console.log("today:", snap.today);
  console.log("promos:", snap.promos.length);
  console.log("parts:", snap.parts.length);
  console.log("animators:", snap.animators.length);
  console.log("qualityReviews:", snap.qualityReviews.length);
  console.log("\n--- PROMOS ---");
  for (const p of snap.promos) {
    const nparts = snap.parts.filter((x) => x.promoId === p.id).length;
    console.log(
      `${p.showName} · ${p.promoName} | status=${p.trackerStatus} pri=${p.priority} cps=${p.cps} dur=${p.initialDurationSec}s parts=${nparts} preProd=${p.preProd?.status ?? "-"} asset=${p.assetTeam ? "Y" : "-"}`
    );
  }
  console.log("\n--- ANIMATORS ---");
  console.log(snap.animators.map((a) => `${a.name}(${a.team === "agency" ? "A" : "H"})`).join(", "));
  console.log("\n--- SAMPLE PARTS ---");
  for (const pt of snap.parts.slice(0, 8)) {
    console.log(`${pt.promoId.split("|")[0]} P${pt.partNo} stage=${pt.stage} status=${pt.status} artist=${pt.artist} dl=${pt.deadline}`);
  }
  console.log("\n--- QUALITY SAMPLE ---");
  for (const q of snap.qualityReviews.slice(0, 5)) {
    console.log(`${q.promoId.split("|")[0]} P${q.partNo} cps=${q.cps} anim=${q.animators.join("/")} oq=${q.animation?.overallQuality}`);
  }
}
main().catch((e) => {
  console.error("SMOKE FAIL:", e);
  process.exit(1);
});
