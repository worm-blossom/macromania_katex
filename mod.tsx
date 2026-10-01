import { Children, Context, Expression } from "macromania";
import { addHtmlDependencyCss } from "macromania-web";
import { Pathish } from "@wormblossom/simple-fs-abstraction";
import * as katex from "katex";

export type KatexConfig = {
  /**
   * Asset path to use as an argument to the
   * [macromania-html-utils](https://github.com/worm-blossom/macromania_html_utils)
   * `addHtmlDependencyStylesheet` function to add the katex stylesheet.
   *
   * If this is `null`, then no assets are added automatically.
   */
  stylesheet?: Pathish | null;
  /**
   * Katex options.
   */
  options?: KatexOptions;
};

/**
 * Options to pass to katex, see {@link https://katex.org/docs/options} for details.
 */
export type KatexOptions = {
  /**
   * Default is `"html"`, unlike in katex.
   */
  output?: "html" | "mathml" | "htmlAndMathml";
  leqno?: boolean;
  fleqn?: boolean;
  /**
   * Corresponds to the `throwOnError` katex option.
   */
  haltOnError?: boolean;
  errorColor?: string;
  /**
   * Discouraged, prefer Macromania macros instead.
   */
  // deno-lint-ignore no-explicit-any
  macros?: Record<string, any>;
  minRuleThickness?: number;
  colorIsTextColor?: boolean;
  maxSize?: number;
  maxExpand?: number;
  /**
   * Default is `false`, unlike in katex.
   */
  // deno-lint-ignore no-explicit-any
  strict?: boolean | any;
  /**
   * Default is `true`, unlike in katex.
   */
  // deno-lint-ignore no-explicit-any
  trust?: boolean | any;
  globalGroup?: boolean;
};

// Do a dance to satisfy the jsr publishing slow-types check.
const katexPreference: [
  (
    props: KatexConfig | {
      children?: Children;
    },
  ) => Expression,
  (ctx: Context) => Required<KatexConfig>,
] = Context.createConfig<KatexConfig>(() => ({
  stylesheet: null,
  options: {
    output: "html",
    leqno: false,
    fleqn: false,
    haltOnError: true,
    errorColor: "#cc0000",
    macros: {},
    minRuleThickness: undefined,
    colorIsTextColor: false,
    maxSize: Infinity,
    maxExpand: 1000,
    strict: false,
    trust: true,
    globalGroup: false,
  },
}));
const ConfigKatex_ = katexPreference[0];
const getConfig = katexPreference[1];

/**
 * The config macro for katex.
 */
export const ConfigKatex = ConfigKatex_;

/**
 * Map a `KatexConfig` and a display mode to options that can be passed to
 * katex.
 */
function configToOptions(
  config: KatexOptions,
  displayMode: boolean,
  // deno-lint-ignore no-explicit-any
): Record<string, any> {
  // deno-lint-ignore no-explicit-any
  const opts: Record<string, any> = { ...config };
  opts.displayMode = displayMode;
  opts.throwOnError = config.haltOnError;
  return opts;
}

/**
 * Return true if we are currently evaluating a descendant of a math mode macro.
 */
export function isMathMode(ctx: Context): boolean {
  return getState(ctx).inMathMode !== "no";
}

/**
 * Return true if we are currently evaluating a descendant of a math mode macro,
 * and the outermost math mode macro is in display mode.
 */
export function isDisplayMode(ctx: Context): boolean {
  return getState(ctx).displayMode;
}

/**
 * Evaluate the children, and then pass them to katex (with `displayMode: false`,
 * and all other options derived from the `ConfigKatex`).
 *
 * @param pre - Text to be placed before the rendered math such that browsers
 * will not insert a line break between this text and the math. This is a
 * workaround for https://github.com/KaTeX/KaTeX/issues/1233
 *
 * @param post - Text to be placed after the rendered math such that browsers
 * will not insert a line break between this text and the math. This is a
 * workaround for https://github.com/KaTeX/KaTeX/issues/1233
 *
 * Both `prefix` and `postfix` work by adding a text span with the class
 * `normalText` to the katex input. Stylesheets should style this text as if it
 * was body text, not math text.
 */
export function M(
  { children, pre, post }: {
    children?: Children;
    pre?: Expression;
    post?: Expression;
  },
): Expression {
  return (
    <KatexMacro
      pre={pre}
      post={post}
      displayMode={false}
    >
      <xs x={children} />
    </KatexMacro>
  );
}

/**
 * Evaluate the children, and then pass them to katex (with `displayMode: true`,
 * and all other options derived from the `ConfigKatex`).
 *
 * @param pre - Text to be placed before the rendered math such that browsers
 * will not insert a line break between this text and the math. This is a
 * workaround for https://github.com/KaTeX/KaTeX/issues/1233
 *
 * @param post - Text to be placed after the rendered math such that browsers
 * will not insert a line break between this text and the math. This is a
 * workaround for https://github.com/KaTeX/KaTeX/issues/1233
 *
 * Both `prefix` and `postfix` work by adding a text span with the class
 * `normalText` to the katex input. Stylesheets should style this text as if it
 * was body text, not math text.
 */
export function MM(
  { children, pre, post }: {
    children?: Children;
    pre?: Expression;
    post?: Expression;
  },
): Expression {
  return (
    <KatexMacro
      pre={pre}
      post={post}
      displayMode
    >
      <xs x={children} />
    </KatexMacro>
  );
}

type KatexState = {
  inMathMode: "no" | "fresh" | "stale";
  displayMode: boolean;
};

const [StateScope, getState, _setState] = Context.createScopedState<KatexState>(
  (
    parentState,
  ) => {
    if (parentState === undefined) {
      return {
        inMathMode: "no",
        displayMode: false,
      };
    } else {
      return {
        inMathMode: parentState.inMathMode === "no" ? "fresh" : "stale",
        displayMode: parentState.inMathMode === "no"
          ? false
          : parentState.displayMode,
      };
    }
  },
);

// Shared implementation of the user-facing math macros.
function KatexMacro(
  { displayMode, children, pre, post }: {
    displayMode: boolean;
    children?: Children;
    pre?: Expression;
    post?: Expression;
  },
): Expression {
  const prefixExps: Expression[] = pre
    ? [
      "\\htmlClass{normalText}{\\text{",
      pre,
      "}}",
    ]
    : [];

  const postfixExps: Expression[] = post
    ? [
      "\\htmlClass{normalText}{\\text{",
      post,
      "}}",
    ]
    : [];

  return (
    <effect
      fun={(ctx) => {
        const parentState = getState(ctx);
        if (
          (parentState.inMathMode !== "no") && !parentState.displayMode &&
          displayMode
        ) {
          ctx.warn(
            `Attempting to output katex in display mode within a non-displaymode katex macro. This is probably a bad idea.`,
          );
        }

        return (
          <StateScope>
            <effect
              fun={(ctx) => {
                if (displayMode) {
                  getState(ctx).displayMode = displayMode;
                }

                return (
                  <map
                    fun={(ctx, evaled) => {
                      const state = getState(ctx);

                      const config = getConfig(ctx);

                      if (config.stylesheet !== null) {
                        addHtmlDependencyCss(ctx, {
                          path: config.stylesheet,
                          logDebugMessage: (ctx: Context) => {
                            ctx.warn(
                              `Trying to add a katex stylesheet because you used the ${
                                ctx.fmtCode(displayMode ? `<MM>` : `<M>`)
                              } macro and configured the ${
                                ctx.fmtCode("macromania-katex")
                              } package to use this asset path for the katex stylesheet.`,
                            );
                          },
                        });
                      }

                      if (state.inMathMode === "fresh") {
                        // Render `evaled` with katex.
                        const config = getConfig(ctx);
                        const opts = configToOptions(
                          config.options!,
                          displayMode,
                        );

                        try {
                          return katex.default.renderToString(evaled, opts);
                        } catch (err) {
                          ctx.error(`Failed to render katex:`);
                          ctx.error(err);
                          ctx.error(`The input that was given to katex:`);
                          ctx.error(evaled);
                          return ctx.halt();
                        }
                      } else {
                        // An outer math macro will do the rendering.
                        return evaled;
                      }
                    }}
                  >
                    <xs x={prefixExps} />
                    <xs x={children} />
                    <xs x={postfixExps} />
                  </map>
                );
              }}
            />
          </StateScope>
        );
      }}
    />
  );
}
