
import { marked } from 'marked';

export const
  index = Symbol('index'),
  rindex = Symbol('rindex'),
  count = Symbol('count');

export type SpecialValue = typeof index | typeof rindex | typeof count;

const
  indent = '  ',
  xmlEscapeMap = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' } as const,
  xmlesc = (s: string) => s.replace(/[<>&'"]/g, m => xmlEscapeMap[m as keyof typeof xmlEscapeMap]),
  embrace = (s: string) => '{' + s.replace(/\n/g, '\n' + indent) + '\n}',
  throwFn = (message: string) => { throw new Error(message); },
  noop = (x: any) => x;

type ProcessExtras = {
  expression: Record<string, any>;
  data: Record<string, any>;
  key: string | symbol;
  checkResult: string | undefined;
};

interface ExpressionLogic {
  type: string;
  process: (value: any, extras: ProcessExtras) => string;
}

interface ExpressionLogicMap {
  text: ExpressionLogic;
  html: ExpressionLogic;
  markdown: ExpressionLogic;
  number: ExpressionLogic;
  date: ExpressionLogic;
  time: ExpressionLogic;
  datetime: ExpressionLogic;
  inputText: ExpressionLogic;
  array: ExpressionLogic;
  object: ExpressionLogic;
  if: ExpressionLogic;
  unless: ExpressionLogic;
}

type ExpressionType = keyof ExpressionLogicMap;

const expressionLogicMap: ExpressionLogicMap = {
  text: {
    type: 'string',
    process: (s: string) => xmlesc(s),
  },
  html: {
    type: 'string',
    process: (s: string) => s,
  },
  markdown: {
    type: 'string',
    process: (s: string) => marked(s) as string,
  },
  number: {
    type: 'number',
    process: (n: number) => n.toLocaleString(),
  },
  date: {
    type: 'Date',
    process: (d: Date) => d.toLocaleDateString(),
  },
  time: {
    type: 'Date',
    process: (d: Date) => d.toLocaleTimeString(),
  },
  datetime: {
    type: 'Date',
    process: (d: Date) => d.toLocaleString(),
  },
  inputText: {
    type: 'string',
    process: (value: string, { expression: exp, checkResult }) =>
      `<div class="formfield ${exp.optional ? 'optional' : 'mandatory'} ${checkResult === undefined ? 'ok' : 'error'}"><label for="${exp.inputText}">${exp.label}</label>` +
      (exp.size[1] === 1 ?
        `<input type="text" name="${exp.inputText}" placeholder="${xmlesc(exp.placeholder)}" cols="${exp.size[0]}" rows="${exp.size[1]}" value="${xmlesc(value)}">` :
        `<textarea name="${exp.inputText}" cols="${exp.size[0]}" rows="${exp.size[1]}">${xmlesc(value)}</textarea>`) +
      (checkResult === undefined ? '' : `<div class="formerror">${checkResult}</div>`) +
      `</div>`,
  },
  // used for deduplication, consistency-checking, types
  array: { type: '[]', process: noop },
  object: { type: '{}', process: noop },
  if: { type: 'if', process: noop },
  unless: { type: 'unless', process: noop },
};

type ExpressionKey = {
  [key in ExpressionType]: string | symbol;
};

interface TemplateArgs {
  literals: TemplateStringsArray;
  expressions: Expression[];
}

interface ExpressionOpts {
  content: TemplateArgs;
  default: any;
  transform: (x: any) => any;
  label: string;
  placeholder: string;
  size: [number, number];
  trim: boolean;
  optional: boolean;
  check: (x: any) => string | undefined;
}

interface Expression extends Partial<ExpressionKey>, Partial<ExpressionOpts> { };

export type Template = (t: (literals: TemplateStringsArray, ...expressions: Expression[]) => any) => any;

export const extractTypes = (template: Template) => {
  const fn = (literals: TemplateStringsArray, ...expressions: any[]) => {
    let types = '';
    const prevTypes: Record<string, string> = {};  // for deduplication and consistency-checking
    for (const exp of expressions) {
      const expType = Object.keys(exp)[0] as ExpressionType;
      const dataKey: string | SpecialValue = exp[expType];

      if (typeof dataKey === 'symbol') continue;  // e.g. indexes

      if (expType === 'if' || expType === 'unless') {
        types += exp.content.replace(/^(\S+):/gm, '$1?:');

      } else {
        const { type } = expressionLogicMap[expType];
        if (prevTypes[dataKey] === type) continue;  // already added this name to types
        else if (prevTypes[dataKey]) throw (`Contradictory types for '${dataKey}': ${type} and ${prevTypes[dataKey]}`);
        prevTypes[dataKey] = type;

        types += '\n' + dataKey + (exp.default ? '?' : '') + ': ';
        if (expType === 'array' || expType === 'object') {
          types += embrace(exp.content) + (expType === 'array' ? '[]' : '') + ';';

        } else {
          types += expressionLogicMap[expType].type + ';';
        }
      }
    }
    return types;
  }
  return embrace(template(fn));
}

const defaultRenderData = {
  [index]: 0,
  [rindex]: 0,
  [count]: 1,
};

export const treeFromTemplate = (template: Template) => {
  return template((literals: TemplateStringsArray, ...expressions: any[]) =>
    ({ literals: Array.from(literals), expressions }));
}

export const render = (template: Template, data: any) => {
  const tree = treeFromTemplate(template);
  const [result] = treeRender(tree, data, false);
  return result;
};

export const checkRender = (template: Template, data: any) => {
  const tree = treeFromTemplate(template);
  const [result, failedChecks] = treeRender(tree, data, true);
  return { result, failedChecks };
}

function treeRender(
  { literals, expressions }: { literals: TemplateStringsArray; expressions: Expression[] },
  data: any,
  check: boolean,
  renderData = defaultRenderData
) {
  let
    result = literals[0],
    failedChecks = 0;

  for (let i = 1, iLen = literals.length; i < iLen; i++) {
    const
      expression = expressions[i - 1],
      expType = Object.keys(expression)[0] as ExpressionType,
      dataKey: string | SpecialValue = expression[expType as keyof typeof expression],
      dataValue = data[dataKey] ?? expression.default;

    if (expType === 'array') {
      for (let j = 0, jLen = dataValue.length; j < jLen; j++) {
        const localRenderData = { [index]: j, [rindex]: jLen - j - 1, [count]: jLen };
        const { content } = expression;
        if (!content) return throwFn(`No 'content' provided for array '${String(dataKey)}'`);
        const [childResult, childFailedChecks] = treeRender(content, dataValue[j], check, localRenderData);
        result += childResult;
        failedChecks += childFailedChecks;
      }

    } else if (expType === 'object') {
      const { content } = expression;
      if (!content) return throwFn(`No 'content' provided for object '${String(dataKey)}'`);
      const [childResult, childFailedChecks] = treeRender(content, dataValue, check, renderData);
      result += childResult;
      failedChecks += childFailedChecks;

    } else {
      let value =
        typeof dataKey === 'string' ? dataValue :
          typeof dataKey === 'symbol' ? renderData[dataKey] :
            throwFn(`Data key must be string or symbol, but was: ${dataKey}`);

      if (expression.transform) value = expression.transform(value);

      if (expType === 'if' || expType === 'unless') {
        if (expType === 'if' ? value : !value) {
          const { content } = expression;
          if (!content) return throwFn(`No 'content' provided for conditional '${String(dataKey)}'`);
          const [childResult, childFailedChecks] = treeRender(content, data, check, renderData);
          result += childResult;
          failedChecks += childFailedChecks;
        }

      } else {
        if (value === undefined) throwFn(`No data supplied for: ${String(dataKey)}`);
        const expressionLogic = expressionLogicMap[expType] ?? throwFn(`Unknown expression type: ${String(expType)}`);

        let checkResult = undefined;
        if (expression.check) {
          checkResult = expression.check(value);
          if (checkResult !== undefined) failedChecks += 1;
        }

        result += expressionLogic.process(value, { expression, data, key: dataKey, checkResult });
      }
    }
    result += literals[i];
  }
  return [result, failedChecks] as [string, number];
}
