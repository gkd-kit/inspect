type RouteBackAction = 'back' | 'home';

export const getRouteBackAction = (back: unknown): RouteBackAction =>
  typeof back == 'string' && back.length > 0 ? 'back' : 'home';

export const useRouteBack = () => {
  const router = useRouter();

  const goBack = async () => {
    const action = getRouteBackAction(router.options.history.state.back);
    if (action == 'back') {
      router.back();
      return;
    }
    await router.push('/');
  };

  return { goBack };
};
