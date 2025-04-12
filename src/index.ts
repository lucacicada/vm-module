import type { ModuleLinker } from 'node:vm'
import { Module, SyntheticModule } from 'node:vm'

export type {
  Module,
  ModuleLinker,
}

export interface ImportDefinition {
  /**
   * The module id.
   */
  id: string | string[]

  /**
   * Make all exports available as default export.
   * ```ts
   * // Both are identical
   * import * as lib from 'lib'
   * import lib from 'lib'
   * ```
   */
  everythingAsDefault?: boolean

  /**
   * The exports of the module.
   *
   * ## Example
   *
   * ```ts
   * vm({
   *  imports: [
   *   {
   *    id: 'lib',
   *    exports: {
   *     fn: () => {
   *    },
   *  },
   * })
   * ```
   *
   * Then you can use the `lib` module:
   *
   * ```ts
   * import { fn } from 'lib'
   * ```
   */
  exports: Record<string, unknown>
}

export type ModuleResolver = (id: string) => Module | Promise<Module>

export interface CreatePluginContextOptions {
  /**
   * Static imports that are available in the module context.
   *
   * ## Example
   *
   * ```ts
   * vm({
   *  imports: [
   *    {
   *     id: 'lib',
   *     exports: {
   *      log: (...value) => {
   *        console.log(...value)
   *      },
   *     },
   *   },
   *  ],
   * })
   * ```
   *
   * Then you can use the `lib` module:
   *
   * ```ts
   * import { log } from 'lib'
   * log('hello world!')
   * ```
   */
  imports?: ModuleLinker | ImportDefinition[]

  /**
   * Named entry points, not available for import.
   * Useful for creating plugins or a single entry to run a script.
   */
  modules?: ModuleResolver | Module[] | Record<string, Module>
}

/**
 * Represents a module context with static imports and named entry points.
 *
 * ## Example
 *
 * ```ts
 * import { createContext } from 'node:vm'
 * import { vm } from 'vm-module'
 *
 * const context = createContext({})
 *
 * const mod = vm({
 *   imports: [
 *     {
 *       id: 'lib',
 *       everythingAsDefault: true,
 *       exports: {
 *         log: (...value) => {
 *           console.log(...value)
 *         },
 *       },
 *     },
 *   ],
 *   modules: {
 *     test: new SourceTextModule(`
 *       import lib from 'lib';
 *       export default () => {
 *         return lib.hello();
 *       }
 *     `, {
 *       context,
 *     }),
 *   },
 * })
 *
 * await mod.resolve('test')
 * ```
 */
export interface VmModule {
  /**
   * Resolve an entry point by id.
   *
   * Equivalent to call `mod.link(linker)` followed by `mod.evaluate()`.
   *
   * @param id - The module id.
   *
   * @returns The module instance.
   *
   * @throws Error if the module cannot be found.
   */
  resolve: (id: string) => Promise<Module>
}

/**
 * Create a module context with static imports and named entry points.
 *
 * ## Example
 *
 * ```ts
 * import { createContext } from 'node:vm'
 * import { vm } from 'vm-module'
 *
 * const context = createContext({})
 *
 * const mod = vm({
 *   imports: [
 *     {
 *       id: 'lib',
 *       everythingAsDefault: true,
 *       exports: {
 *         log: (...value) => {
 *           console.log(...value)
 *         },
 *       },
 *     },
 *   ],
 *   modules: {
 *     test: new SourceTextModule(`
 *       import lib from 'lib';
 *       export default () => {
 *         return lib.hello();
 *       }
 *     `, {
 *       context,
 *     }),
 *   },
 * })
 *
 * await mod.resolve('test')
 * ```
 */
export function vm(options?: CreatePluginContextOptions): VmModule {
  const { imports, modules } = options ?? {}

  // Cache the resolved modules, they hold an internal state
  const moduleCache = new Map<string, Module>()

  const linker: ModuleLinker = async (specifier, referencingModule, extra) => {
    if (moduleCache.has(specifier)) {
      return moduleCache.get(specifier)!
    }

    if (typeof imports === 'function') {
      const module = await imports(specifier, referencingModule, extra)

      if (module) {
        moduleCache.set(specifier, module)

        return module
      }
    }
    else if (imports) {
      for (const m of imports) {
        const moduleIds = Array.isArray(m.id) ? m.id : [m.id]
        const moduleId = moduleIds[0]!

        if (moduleIds.includes(specifier)) {
          const keys = Object.keys(m.exports)

          if (m.everythingAsDefault) {
            keys.push('default')
          }

          const cm = new SyntheticModule(
            keys,
            () => {
              for (const key of keys) {
                cm.setExport(key, m.exports[key])
              }

              if (m.everythingAsDefault) {
                cm.setExport('default', m.exports)
              }
            },
            {
              identifier: moduleId,
              context: referencingModule.context,
            },
          )

          for (const id of keys) {
            moduleCache.set(id, cm)
          }

          return cm
        }
      }
    }

    return undefined as unknown as Module
  }

  // Modules that cannot be imported by other modules
  const namedModules = new Map<string, Module>()

  const resolve = async (id: string): Promise<Module> => {
    if (namedModules.has(id)) {
      return namedModules.get(id)!
    }

    let module: Module | undefined

    if (typeof modules === 'function') {
      module = await modules(id)
    }
    else if (modules instanceof Module) {
      module = modules
    }
    else if (Array.isArray(modules)) {
      const namedModule = modules.find(m => m instanceof Module && m.identifier === id)

      if (namedModule) {
        module = namedModule
      }
    }
    else if (modules && typeof modules === 'object' && modules[id] instanceof Module) {
      module = modules[id]
    }

    if (module) {
      await module.link(linker)
      await module.evaluate()

      namedModules.set(id, module)

      return module
    }

    throw new Error(`Module not found: ${id}`)
  }

  return {
    resolve,
  }
}
