async function main() {
  try {
    const res = await fetch("http://localhost:3000/armada");
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Contains '68 armada':", text.includes("68 armada"));
    console.log("Contains 'BM 8106 QP':", text.includes("BM 8106 QP"));
    console.log("Contains 'Sialang Sakti':", text.includes("Sialang Sakti"));
    console.log("Contains '01/DLHK/I-OPS/I/2026':", text.includes("01/DLHK/I-OPS/I/2026"));
    console.log("Contains 'HARAPAN JAYA':", text.includes("HARAPAN JAYA"));
  } catch (err: any) {
    console.error("Fetch error:", err.message);
  }
}
main();
