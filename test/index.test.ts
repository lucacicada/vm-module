import { constants, createContext, SourceTextModule } from 'node:vm'
import { expect, it } from 'vitest'
import { vm } from '../src/index'

it('should work create a module context', async () => {
  const context = createContext(constants.DONT_CONTEXTIFY, {
    codeGeneration: {
      strings: false,
      wasm: false,
    },
  })

  const mod = vm({
    imports: [
      {
        id: 'lib',
        everythingAsDefault: true,
        exports: {
          hello: () => {
            return 'hello'
          },
        },
      },
    ],
    modules: [
      {
        name: 'test',
        setup() {
          return new SourceTextModule(`
            import lib from 'lib';
            export default () => {
              return lib.hello();
            }
          `, {
            context,
          })
        },
      },
    ],
  })

  await mod.resolve('test')
  const res = await mod.call('test', 'default')

  expect(res).toBe('hello')
})
