
import { marked } from 'marked';

const
  index = Symbol('index'),
  rindex = Symbol('rindex'),
  count = Symbol('count');

const
  xmlEscapeMap = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' } as const,
  xmlesc = (s: string) => s.replace(/[<>&'"]/g, m => xmlEscapeMap[m as keyof typeof xmlEscapeMap]);

const indent = '  ';

const expressionMap = {
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
  // used for deduplication, consistency-checking, types
  array: { type: '[]' },
  object: { type: '{}' },
  if: { type: null },
  unless: { type: null },
};

type DataType = keyof typeof expressionMap;

type Expression = {
  [key in DataType]?: string | symbol;
} | {
  content: Template;
  default: any;
  transform: (x: any) => any;
};

type Template = (t: (literals: TemplateStringsArray, ...expressions: Expression[]) => any) => any;

const recipe: Template = t => t`
  <h2>
    ${{ number: index, transform: i => i + 1 }}.
    <a href="${{ text: 'url' }}">${{ text: 'name' }}</a>
    ${{ if: 'steps', content: t`<div class="steps">${{ markdown: 'steps' }}</div>` }}
    ${{ date: 'createdat' }}
  </h2>`;

const layout: Template = t => t`
  <html>
    <head>
      <title>${{ text: 'heading' }} (${{ number: 'number' }})</title>
      ${{ html: 'head' }}
    </head>
    <body>
      <h1>${{ text: 'heading' }}</h1>
      <div class="description">${{ markdown: 'description', default: '_Some_ recipe' }}</div>
      ${{ array: 'recipes', content: recipe(t) }}
      ${{ object: 'user', content: t`<p>User name: ${{ text: 'name' }}</p>` }}
    </body>
  </html>`;

const embrace = (s: string) => '{' + s.replace(/\n/g, '\n' + indent) + '\n}';

const extractTypes = (template) => {
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
        const { type } = expressionMap[dataType];
        if (prevTypes[dataKey] === type) continue;  // already added this name to types
        else if (prevTypes[dataKey]) throw (`Contradictory types for '${dataKey}': ${type} and ${prevTypes[dataKey]}`);
        prevTypes[dataKey] = type;

        types += '\n' + dataKey + (exp.default ? '?' : '') + ': ';
        if (dataType === 'array' || dataType === 'object') {
          types += embrace(exp.content) + (dataType === 'array' ? '[]' : '') + ';';

        } else {
          types += expressionMap[dataType].type + ';';
        }
      }
    }
    return types;
  }
  return embrace(template(fn));
}

console.log(extractTypes(layout));

interface Data {
  heading: string;
  number: number;
  head: string;
  description?: string;
  recipes: {
    url: string;
    name: string;
    steps?: string;
    createdat: Date;
  }[];
  user: {
    name: string;
  };
}

const data: Data = {
  heading: 'Beans & cheese',
  number: 1234567,
  head: '<meta charset="utf-8">',
  description: '**Important** information',
  recipes: [{
    url: 'bread',
    name: 'Bread',
    createdat: new Date(),
  }, {
    url: 'sausage-pasta',
    name: 'Sausage Pasta',
    createdat: new Date(),
    steps: 'Do this, then do that',
  }],
  user: {
    name: 'George',
  },
};

const defaultRenderData = {
  [index]: 0,
  [rindex]: 0,
  [count]: 0,
};

const render = (template, data) => {
  const fn = (literals: TemplateStringsArray, ...expressions: any[]) => ({ literals: Array.from(literals), expressions });
  const tree = template(fn);
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
      for (let j = 0, jLen = dataValue.length; j < jLen; j ++) {
        const localRenderData = { [index]: j, [rindex]: jLen - j - 1, [count]: jLen };
        result += treeRender(expression.content, dataValue[j], localRenderData);
      }

    } else if (dataType === 'object') {
      result += treeRender(expression.content, dataValue, renderData);

    } else {
      let value = typeof dataKey === 'string' ? dataValue : renderData[dataKey];
      if (expression.transform) value = expression.transform(value);

      if (dataType === 'if' || dataType === 'unless') {
        if (dataType === 'if' ? value : !value) result += treeRender(expression.content, data, renderData);

      } else {
        result += expressionMap[dataType].process(value);
      }
    }
    result += literals[i];
  }
  return result;
}


console.log(render(layout, data));
