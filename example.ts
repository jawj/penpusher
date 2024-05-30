import type { Template } from '.';
import { extractTypes, render, index, checkRender } from '.';

const recipeCard: Template = t => t`
  <h2>
    ${{ number: index, transform: i => i + 1 }}. 
    <a href="${{ text: 'url' }}">${{ text: 'name' }}</a>
  </h2>
  ${{ if: 'steps', content: t`<div class="steps">${{ markdown: 'steps' }}</div>` }}
  ${{ date: 'createdat' }}`;

const layout: Template = t => t`
  <html>
    <head>
      <title>${{ text: 'heading' }} (${{ number: 'number' }})</title>
      ${{ html: 'head' }}
    </head>
    <body>
      <h1>${{ text: 'heading' }}</h1>
      <div class="description">${{ markdown: 'description', default: '_Some_ recipe' }}</div>
      ${{ array: 'recipes', content: recipeCard(t) }}
      ${{ object: 'user', content: t`<p>User name: ${{ text: 'name' }}</p>` }}
    </body>
  </html>`;

const checkLength = (s: string, min: number, max: number) =>
  (s.length < min || s.length > max) ? (
    min > 0 ? `Must be between ${min} and ${max} characters` :
      `Cannot be more than ${max} characters`
  ) : undefined;


const recipeForm: Template = t => t`
  <form method="post">
  ${{
    inputText: 'name',
    label: 'Name',
    placeholder: 'Ragu alla nonna',
    size: [80, 1],
    optional: false, // default
    trim: true,  // default
    check: (s: string) => checkLength(s, 1, 250),
  }}
  ${{
    inputText: 'subtitle',
    label: 'Subtitle',
    placeholder: 'A tasty Italian classic',
    size: [80, 2],
    optional: true,
    check: (s: string) => checkLength(s, 0, 500),
  }}
  ${{
    inputText: 'ingredients',
    label: 'Ingredients',
    placeholder: '1 white onion, finely chopped\n...',
    size: [80, 10],
    optional: true,
    check: (s: string) => checkLength(s, 0, 5000),
  }}
  ${{
    inputText: 'method',
    label: 'Method',
    placeholder: 'Fry the onion on a low heat until soft.\n...',
    size: [80, 20],
    optional: true,
    check: (s: string) => checkLength(s, 0, 10000),
  }}
  </form>
`;

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

console.log(extractTypes(layout));
console.log(render(layout, data));

console.log(extractTypes(recipeForm));
console.log(checkRender(recipeForm, { name: '', subtitle: 'y', ingredients: 'z', method: 'a' }));
