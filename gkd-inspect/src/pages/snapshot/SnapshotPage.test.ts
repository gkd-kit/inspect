/* eslint-disable vue/one-component-per-file -- 路由回归测试需要组合页面和查看器替身。 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import {
  compile,
  createRenderer,
  defineComponent,
  h,
  nextTick,
  ref,
} from 'vue';
import {
  createMemoryHistory,
  createRouter,
  RouterView,
  useRoute,
} from 'vue-router';
import { useSnapshotRoute } from '@/features/snapshot-inspector/snapshot_route';

test('reloads the snapshot when switching between shared and local routes', async () => {
  const template = readFileSync(
    new URL('./SnapshotPage.vue', import.meta.url),
    'utf8',
  ).match(/<template>([\s\S]*?)<\/template>/)![1];
  const loaded: string[] = [];
  let mounts = 0;
  const inspector = defineComponent({
    setup() {
      mounts += 1;
      const image = ref('');
      const load = (path: string) => {
        loaded.push(path);
        image.value = path;
      };
      useSnapshotRoute(
        (to) => load(to.path),
        () => {},
      );
      return () => h('img', { src: image.value });
    },
  });
  const page = defineComponent({
    components: { SnapshotInspectorView: inspector },
    setup: () => ({ route: useRoute() }),
    render: compile(template),
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/i/:github_asset_id', component: page },
      { path: '/snapshot/:snapshotId', component: page },
    ],
  });
  interface HostNode {
    props: Record<string, unknown>;
  }
  let image: HostNode | undefined;
  const renderer = createRenderer<HostNode, HostNode>({
    createElement: (tag) => {
      const node = { props: {} };
      if (tag === 'img') image = node;
      return node;
    },
    createText: () => ({ props: {} }),
    createComment: () => ({ props: {} }),
    insert: () => {},
    remove: () => {},
    setText: () => {},
    setElementText: () => {},
    parentNode: () => null,
    nextSibling: () => null,
    patchProp: (node, key, _previous, value) => {
      node.props[key] = value;
    },
  });
  await router.push('/i/1');
  const app = renderer.createApp({ render: () => h(RouterView) });
  app.use(router);
  app.mount({ props: {} });
  try {
    for (const path of ['/snapshot/2', '/snapshot/3', '/i/4']) {
      await router.push(path);
      await nextTick();
      assert.equal(image?.props.src, path);
    }
    assert.deepEqual(loaded, ['/i/1', '/snapshot/2', '/snapshot/3', '/i/4']);
    assert.equal(mounts, 1, '切换快照不应重新挂载查看器');
  } finally {
    app.unmount();
  }
});
