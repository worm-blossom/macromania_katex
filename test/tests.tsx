import { evaluate } from "macromania";

import { ConfigFs, Dir, File } from "@wormblossom/macromania-fs";
import { SimpleFsDeno } from "@wormblossom/simple-fs-deno";
import { ASSET_COPY, Assets } from "macromania-web";
import { Html5 } from "macromania-web";
import { ServerRoot } from "macromania-web";
import { dynamicKatexAssets } from "../vals.ts";

import { ConfigKatex, M, MM } from "../mod.tsx";

const exp = (
  <ConfigFs fs={new SimpleFsDeno(".")}>
    <Dir name="build" mode="assertive">
      <ServerRoot domain="example.org">
        <Assets
          input="assets"
          output="assetsOut"
          dynamicAssets={[
            ...dynamicKatexAssets("katex_assets"),
          ]}
          transformations={[
            ["/katex_assets/fonts", ASSET_COPY, "ignore"],
          ]}
        >
          <ConfigKatex stylesheet="/katex_assets/katex.min.css">
            <File name="z.html">
              <Html5 title="testfile">
                <M>x^2</M>
              </Html5>
            </File>
          </ConfigKatex>
        </Assets>
      </ServerRoot>
    </Dir>
  </ConfigFs>
);

await evaluate(exp);
