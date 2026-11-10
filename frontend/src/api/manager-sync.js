// Manager-only coordination: a save invalidates reads started before it.
let mutations = 0;
const listeners = new Set();
export const isManagerMutating = () => mutations > 0;
export const subscribeManagerMutations = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function beginManagerMutation() {
  mutations += 1;
  if (mutations === 1) listeners.forEach(listener => listener(true));
  return () => {
    mutations -= 1;
    if (mutations === 0) listeners.forEach(listener => listener(false));
  };
}
