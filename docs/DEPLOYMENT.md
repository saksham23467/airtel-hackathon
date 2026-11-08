# Deployment

Checked on 7 November 2026.

The app process on the build machine answers a shell HTTP request. A managed desktop browser pointed at that machine’s localhost or box address does not. The parent’s report was HTTP 403 from the box address, with no matching 403 from this Next.js process, and box-doctor passed all 11 checks. That 403 is in front of the process. No tunnel, proxy, or port bypass was added.

There is no linked Cursor environment for this run (`environment` is null). The page `https://cursor.com/agents/bc-2a23a346-ab5c-57d6-90b1-20cbada5dc04` is the agent transcript. It does not serve this website.

`VERCEL_TOKEN` is unset. No Vercel project was created. No Origin or GitHub Pages site was created. A public URL would also publish the case CSVs and the specimen KYC images that ship inside the app, which this build does not do.

What you can do:

1. Unzip `lean-source.zip` on your Mac and follow `docs/MAC.md`. The browser on that Mac talks to the server on that Mac. Those Mac binaries have not been executed.
2. If a hyperlink is still required in the deck, you choose a private host yourself and accept that anyone with the link can exercise the synthetic case data. That host was not created here, because it was not approved and it would publish the case files.

Do not use the build machine’s `127.0.0.1` as the demo URL. It is not your computer.
