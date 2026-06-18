// Supabase Free 플랜 7일 미접속 일시정지 방지용 ping 엔드포인트.
// Vercel Cron(vercel.json crons)이 매일 호출하여 DB에 가벼운 SELECT를 실행한다.
// anon 키만 사용하며, public read 정책(using(true))이 걸린 roles 테이블을 LIMIT 1로 조회.
export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('[ping] Supabase 환경변수 누락');
    return res.status(500).json({ ok: false, error: 'missing_env' });
  }

  try {
    const r = await fetch(`${url}/rest/v1/roles?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const ok = r.ok;
    console.log(`[ping] supabase ${r.status} ${ok ? 'OK' : 'FAIL'}`);
    return res.status(ok ? 200 : 502).json({
      ok,
      status: r.status,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[ping] 요청 실패', e);
    return res.status(502).json({ ok: false, error: String(e) });
  }
}
