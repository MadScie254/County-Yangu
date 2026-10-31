// Types for worker/index.js, so the unit test can import it.
declare const worker: {
  fetch(request: Request, env: { ASSETS: { fetch(request: Request): Promise<Response> } }): Promise<Response>;
};
export default worker;
