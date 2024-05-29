
import { marked } from 'marked';

export const
  index = Symbol('index'),
  rindex = Symbol('rindex'),
  count = Symbol('count');

export type Template = (t: (literals: TemplateStringsArray, ...expressions: Expression[]) => any) => any;

const
  indent = '  ',
  xmlEscapeMap = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' } as const,
  xmlesc = (s: string) => s.replace(/[<>&'"]/g, m => xmlEscapeMap[m as keyof typeof xmlEscapeMap]),
  embrace = (s: string) => '{' + s.replace(/\n/g, '\n' + indent) + '\n}',
  throwFn = (message: string) => { throw new Error(message); }

const expressionLogics = {
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
    process: (s: string) => marked(s),
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
    process: (value: string, exp: Record<string, any>) =>
      exp.size[1] === 1 ?
        `<input type="text" name="${exp.inputText}" placeholder="${xmlesc(exp.placeholder)}" cols="${exp.size[0]}" rows="${exp.size[1]}" value="${xmlesc(value)}">` :
        `<textarea name="${exp.inputText}" cols="${exp.size[0]}" rows="${exp.size[1]}">${xmlesc(value)}</textarea>`,
  },
  // used for deduplication, consistency-checking, types
  array: { type: '[]' },
  object: { type: '{}' },
  if: { type: null },
  unless: { type: null },
};

type DataType = keyof typeof expressionLogics;

type Expression = {
  [key in DataType]?: string | symbol;
} | {
  content: Template;
  default: any;
  transform: (x: any) => any;
  label: string;
  placeholder: string;
  size: [number, number];
  trim: boolean;
  optional: boolean;
  check: (x: any) => string | undefined;
};

export const extractTypes = (template: Template) => {
  const fn = (literals: TemplateStringsArray, ...expressions: any[]) => {
    let types = '';
    const prevTypes = {};  // for deduplication and consistency-checking
    for (const exp of expressions) {
      const dataType = Object.keys(exp)[0];
      const dataKey = exp[dataType];

      if (typeof dataKey === 'symbol') continue;  // e.g. indexes

      if (dataType === 'if' || dataType === 'unless') {
        types += exp.content.replace(/^(\S+):/gm, '$1?:');

      } else {
        const { type } = expressionLogics[dataType];
        if (prevTypes[dataKey] === type) continue;  // already added this name to types
        else if (prevTypes[dataKey]) throw (`Contradictory types for '${dataKey}': ${type} and ${prevTypes[dataKey]}`);
        prevTypes[dataKey] = type;

        types += '\n' + dataKey + (exp.default ? '?' : '') + ': ';
        if (dataType === 'array' || dataType === 'object') {
          types += embrace(exp.content) + (dataType === 'array' ? '[]' : '') + ';';

        } else {
          types += expressionLogics[dataType].type + ';';
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

export const render = (template: Template, data: any) => {
  const
    fn = (literals: TemplateStringsArray, ...expressions: any[]) =>
      ({ literals: Array.from(literals), expressions }),
    tree = template(fn);

  return treeRender(tree, data);
};

function treeRender({ literals, expressions }: { literals: TemplateStringsArray; expressions: any[] }, data: any, renderData = defaultRenderData) {
  let result = literals[0];
  for (let i = 1, iLen = literals.length; i < iLen; i++) {
    const
      expression = expressions[i - 1],
      dataType = Object.keys(expression)[0],
      dataKey = expression[dataType],
      dataValue = data[dataKey] ?? expression.default;

    if (dataType === 'array') {
      for (let j = 0, jLen = dataValue.length; j < jLen; j++) {
        const localRenderData = { [index]: j, [rindex]: jLen - j - 1, [count]: jLen };
        result += treeRender(expression.content, dataValue[j], localRenderData);
      }

    } else if (dataType === 'object') {
      result += treeRender(expression.content, dataValue, renderData);

    } else {
      let value =
        typeof dataKey === 'string' ? dataValue :
          typeof dataKey === 'symbol' ? renderData[dataKey] :
            throwFn(`Data key must be string or symbol, but was: ${dataKey}`);

      if (expression.transform) value = expression.transform(value);

      if (dataType === 'if' || dataType === 'unless') {
        if (dataType === 'if' ? value : !value) result += treeRender(expression.content, data, renderData);

      } else {
        const expressionLogic = expressionLogics[dataType] ?? throwFn(`Unknown expression type: ${dataType}`);
        result += expressionLogic.process(value ?? throwFn(`No data supplied for: ${dataKey}`), expression);
      }
    }
    result += literals[i];
  }
  return result;
}
