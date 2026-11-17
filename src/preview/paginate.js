// Greedy page filling. heights[i] is the rendered height of atom i, keepNext[i] glues atom i to atom i+1.
export function paginate(heights, keepNext, limit) {
  const pages = [[]];
  let used = 0;
  const cur = () => pages[pages.length - 1];
  const place = (i) => { cur().push(i); used += heights[i]; };
  const newPage = () => { if (cur().length) { pages.push([]); used = 0; } };
  const n = heights.length;
  let i = 0;
  while (i < n) {
    let j = i;
    let h = heights[i];
    while (j < n - 1 && keepNext[j]) { j += 1; h += heights[j]; }
    if (used + h <= limit + 0.5) {
      for (let k = i; k <= j; k++) place(k);
    } else if (h <= limit) {
      newPage();
      for (let k = i; k <= j; k++) place(k);
    } else {
      for (let k = i; k <= j; k++) { if (used + heights[k] > limit + 0.5) newPage(); place(k); }
    }
    i = j + 1;
  }
  return pages;
}
