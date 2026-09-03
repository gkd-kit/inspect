export {};

declare module 'vue' {
  export interface GlobalComponents {
    SvgIcon: typeof import('@/components/base/SvgIcon.vue').default;
  }
}
