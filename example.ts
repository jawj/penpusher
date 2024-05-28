import type { Template } from '.';
import { extractTypes, render, index } from '.';

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
