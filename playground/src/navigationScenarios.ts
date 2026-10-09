import { type Ref, ref } from 'vue'

/** Whether the page of the "page fails to load" scenario fails to load. */
export const shouldPageLoadFail: Ref<boolean> = ref(true)
