import type { SlotsType } from 'vue';

const emptyArray = [] as [];
const GapList = defineComponent<
  { tag?: string; virtual?: boolean },
  {},
  string,
  SlotsType<{
    default: () => VNode[];
    gap: (props: { index: number }) => VNode[];
  }>
>(
  (props, ctx) => {
    const tag = computed(() => props.tag || 'div');
    return () => {
      const defaultNodes = (ctx.slots.default?.() || emptyArray).filter((n) => {
        return typeof n.type !== 'symbol'; // remove comment nodes
      });
      const nodes: typeof defaultNodes = [];
      if (defaultNodes.length > 0) {
        nodes.push(defaultNodes[0]);
      }
      if (defaultNodes.length > 1) {
        for (let i = 1; i < defaultNodes.length; i++) {
          const gapNodes = ctx.slots.gap?.({ index: i - 1 }) || emptyArray;
          nodes.push(...gapNodes);
          nodes.push(defaultNodes[i]);
        }
      }
      if (props.virtual) return nodes;
      return h(tag.value, props, nodes);
    };
  },
  { props: ['tag', 'virtual'] },
);

export default GapList;
