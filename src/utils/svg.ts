const modules = import.meta.glob<string>('@/assets/svg/*.svg', {
  eager: true,
  query: 'raw',
  import: 'default',
});

export default Object.fromEntries(
  Object.entries(modules).map(([k, v]) => {
    const name = k.split('/').at(-1)!.split('.')[0];
    const t = document.createElement('template');
    t.innerHTML = v;
    return [name, t.content.firstChild as SVGSymbolElement];
  }),
);
