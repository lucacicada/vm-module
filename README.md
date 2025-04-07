# vm-module

A library to create a module/plugin system in node.

It uses the experimental `--experimental-vm-modules`.

```bash
pnpm i vm-module
```

```ts
import { resolve } from 'node:path'
import { constants, createContext, SourceTextModule } from 'node:vm'
import { vm } from 'vm-module'

// Create a context in which to run the plugin
const context = createContext(constants.DONT_CONTEXTIFY)

// Give the context access to some global variables
context.URL = URL
context.URLSearchParams = URLSearchParams

// Declare the built in imports
const mod = vm({
  imports: [
    {
      id: ['node:path', 'path']
      everythingAsDefault: true,
      exports: {
        resolve
      },
    },
  ],
  // Load a simple plugin from the file system
  modules: async (identifier) => {
    const filePath = resolve('plugins', `${identifier}.js`)

    const source = await readFile(filePath, 'utf-8')

    return new SourceTextModule(source, {
      identifier,
      context,
    })
  }
})

const m = await mod.resolve('script')

// Run the plugin function
m.namespace.default.helper()
```

```js
// plugins/script.js

// Import any pre-defined dependencies you have declared
import { resolve } from 'node:path'

export default {
  helper: () => {
    // The script have access to the context
    const url = new URL('https://example.com')

    return resolve('file-path')
  }
}
```
