import {
  Context,
  createConfigOptions,
  createLogger,
  createSubstate,
  Expression,
  Expressions,
  expressions,
  katex,
} from "./deps.ts";

const l = createLogger("LoggerKatex");
const ConfigMacro = l.ConfigMacro;
export { ConfigMacro as LoggerKatex };

/**
 * Options to pass to katex, see https://katex.org/docs/options for details.
 */
export type KatexConfig = {
  /**
   * Default is `"html"`, unlike in katex.
   */
  output?: "html" | "mathml" | "htmlAndMathml";
  leqno?: boolean;
  fleqn?: boolean;
  /**
   * Maps to the `throwOnError` katex option.
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
   * Defalt is `true`, unlike in katex.
   */
  // deno-lint-ignore no-explicit-any
  trust?: boolean | any;
  globalGroup?: boolean;
};

const [
  getConfig,
  ConfigKatex,
] = createConfigOptions<KatexConfig, KatexConfig>(
  "ConfigKatex",
  {
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
  (oldValue, update) => {
    const newValue = { ...oldValue };
    if (update.output !== undefined) {
      newValue.output = update.output;
    }
    if (update.leqno !== undefined) {
      newValue.leqno = update.leqno;
    }
    if (update.fleqn !== undefined) {
      newValue.fleqn = update.fleqn;
    }
    if (update.haltOnError !== undefined) {
      newValue.haltOnError = update.haltOnError;
    }
    if (update.errorColor !== undefined) {
      newValue.errorColor = update.errorColor;
    }
    if (update.macros !== undefined) {
      newValue.macros = update.macros;
    }
    if (update.minRuleThickness !== undefined) {
      newValue.minRuleThickness = update.minRuleThickness;
    }
    if (update.colorIsTextColor !== undefined) {
      newValue.colorIsTextColor = update.colorIsTextColor;
    }
    if (update.maxSize !== undefined) {
      newValue.maxSize = update.maxSize;
    }
    if (update.maxExpand !== undefined) {
      newValue.maxExpand = update.maxExpand;
    }
    if (update.strict !== undefined) {
      newValue.strict = update.strict;
    }
    if (update.trust !== undefined) {
      newValue.trust = update.trust;
    }
    if (update.globalGroup !== undefined) {
      newValue.globalGroup = update.globalGroup;
    }
    return newValue;
  },
);
export { ConfigKatex };

/**
 * Map a `KatexConfig` and a display mode to options that can be passed to
 * katex.
 */
function configToOptions(
  config: KatexConfig,
  displayMode: boolean,
  // deno-lint-ignore no-explicit-any
): Record<string, any> {
  // deno-lint-ignore no-explicit-any
  const opts: Record<string, any> = { ...config };
  opts.displayMode = displayMode;
  opts.throwOnError = config.haltOnError;
  return opts;
}

type KatexState = {
  inMathMode: "no" | "fresh" | "stale";
  displayMode: boolean;
};

const [getState, setState] = createSubstate<KatexState>({
  inMathMode: "no",
  displayMode: false,
});

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
 * @param prefix - Text to be placed before the rendered math such that browsers
 * will not insert a line break between this text and the math. This is a
 * workaround for https://github.com/KaTeX/KaTeX/issues/1233
 *
 * @param postfix - Text to be placed after the rendered math such that browsers
 * will not insert a line break between this text and the math. This is a
 * workaround for https://github.com/KaTeX/KaTeX/issues/1233
 *
 * Both `prefix` and `postfix` work by adding a text span with the class
 * `normalText` to the katex input. Stylesheets should style this text as if it
 * was body text, not math text.
 */
export function M(
  { children, prefix, postfix }: {
    children?: Expressions;
    prefix?: Expressions;
    postfix?: Expressions;
  },
): Expression {
  return (
    <KatexMacro
      prefix={prefix}
      postfix={postfix}
      displayMode={false}
      children={children}
    />
  );
}

/**
 * Evaluate the children, and then pass them to katex (with `displayMode: true`,
 * and all other options derived from the `ConfigKatex`).
 *
 * @param prefix - Text to be placed before the rendered math such that browsers
 * will not insert a line break between this text and the math. This is a
 * workaround for https://github.com/KaTeX/KaTeX/issues/1233
 *
 * @param postfix - Text to be placed after the rendered math such that browsers
 * will not insert a line break between this text and the math. This is a
 * workaround for https://github.com/KaTeX/KaTeX/issues/1233
 *
 * Both `prefix` and `postfix` work by adding a text span with the class
 * `normalText` to the katex input. Stylesheets should style this text as if it
 * was body text, not math text.
 */
export function MM(
  { children, prefix, postfix }: {
    children?: Expressions;
    prefix?: Expressions;
    postfix?: Expressions;
  },
): Expression {
  return (
    <KatexMacro
      prefix={prefix}
      postfix={postfix}
      displayMode={true}
      children={children}
    />
  );
}

// Shared implementation of the user-facing math macros.
function KatexMacro(
  { displayMode, children, prefix, postfix }: {
    displayMode: boolean;
    children?: Expressions;
    prefix?: Expressions;
    postfix?: Expressions;
  },
): Expression {
  let oldState: KatexState = {
    inMathMode: "no",
    displayMode: false,
  };

  const prefixExps: Expression[] = prefix
    ? [
      "\\htmlClass{normalText}{\\text{",
      <fragment exps={expressions(prefix)} />,
      "}}",
    ]
    : [];

  const postfixExps: Expression[] = postfix
    ? [
      "\\htmlClass{normalText}{\\text{",
      <fragment exps={expressions(postfix)} />,
      "}}",
    ]
    : [];

  return (
    // Update the `KatexState` for the inner expressions.
    <lifecycle pre={pre} post={post}>
      <map fun={map}>
        <fragment
          exps={[...prefixExps, ...expressions(children), ...postfixExps]}
        />
      </map>
    </lifecycle>
  );

  function pre(ctx: Context) {
    oldState = { ...getState(ctx) };
    const newState: KatexState = {
      inMathMode: oldState.inMathMode === "no" ? "fresh" : "stale",
      displayMode: oldState.inMathMode === "no"
        ? displayMode
        : oldState.displayMode,
    };
    setState(ctx, newState);
  }

  function post(ctx: Context) {
    setState(ctx, oldState);
  }

  function map(evaled: string, ctx: Context): Expression {
    const state = getState(ctx);

    if (state.inMathMode === "fresh") {
      // Render `evaled` with katex.
      const config = getConfig(ctx);
      const opts = configToOptions(config, displayMode);

      try {
        return katex.default.renderToString(evaled, opts);
      } catch (err) {
        l.error(ctx, "Failed to render katex:");
        l.error(ctx, err);
        l.error(ctx, "The input that was given to katex:");
        l.error(ctx, evaled);
        return ctx.halt();
      }
    } else {
      // An outer math macro will do the rendering.
      return evaled;
    }
  }
}
