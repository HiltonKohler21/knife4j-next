<template>
  <div class="knife4j-markdown" v-html="markdownSource">
  </div>
</template>

<script>
import "@/assets/css/markdown-preview.css";
import { marked, enableMarkdownCodeRenderer } from '@/core/markdown.js';
import mermaid from 'mermaid';

mermaid.initialize({ logLevel: 5, startOnLoad: false });

enableMarkdownCodeRenderer();
export default {
  name: "Markdown",
  props: {
    source: {
      type: String
    }
  },
  computed: {
    markdownSource() {
      return marked.parse(this.source);
    }
  },
  updated() {
    mermaid.run({ querySelector: '.knife4j-markdown .mermaid' });
  },
  mounted() {
    mermaid.run({ querySelector: '.knife4j-markdown .mermaid' });
  }
}
</script>

<style>
/* #528: flex parents (e.g. a-row.markdown-body) must not grow with long tokens / pre */
.knife4j-markdown {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
