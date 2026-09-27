/**
 * GitHub Pages sürümü: `pg` (node-postgres) paketinin yerine geçer.
 * Tarayıcıda gerçek bağlantı açılmaz; sorgular drizzle-shim → PGlite üzerinden gider.
 * Bu sınıf yalnızca `new Pool(...)` çağrısının hata vermemesi içindir.
 */
export class Pool {
  constructor(..._args: unknown[]) {}
  on() { return this; }
  async connect(): Promise<never> { throw new Error("Tarayıcı modunda doğrudan bağlantı yok."); }
  async query(): Promise<never> { throw new Error("Tarayıcı modunda doğrudan sorgu yok."); }
  async end() {}
}

export const types = { setTypeParser() {}, getTypeParser() { return (v: unknown) => v; } };

export default { Pool, types };
