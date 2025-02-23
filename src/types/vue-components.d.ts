export {};

declare module 'vue' {
  export interface GlobalComponents {
    SvgIcon: typeof import('@/components/SvgIcon.vue').default;
  }
}
