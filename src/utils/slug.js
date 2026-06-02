// Mirrors backend slugify_ in Code.gs so an optimistic frontend-added Polza task
// shares the same id the backend will derive on its server-side append.

const TRANSLIT = {
  "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z",
  "и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
  "с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch","ш":"sh","щ":"shch",
  "ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"
};

export function slugify(name) {
  const lower = String(name || "").toLowerCase();
  let out = "";
  for (const ch of lower) out += TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch;
  return out.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unnamed";
}
