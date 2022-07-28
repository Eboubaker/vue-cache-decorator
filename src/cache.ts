import Vue from "vue";
import { WatchOptionsWithHandler } from "vue/types/options";
import cloneDeep =  require("lodash.clonedeep");

const createDecorator = factory => {
    return (target, key) => {
        const Ctor = typeof target === "function" ? target : target.constructor;
        if (!Ctor.__decorators__) {
            Ctor.__decorators__ = [];
        }
        Ctor.__decorators__.push(options => factory(options, key));
    };
};

/**
 * generate the localStorage key for the property key
 * @param vm vue component
 * @param key property name
 * @param options
 */
const makeKey = (vm: Vue, key: string, options?: CacheOptions) => {
    if (options?.cacheKey) return options.cacheKey;
    if (!vm.$vnode.tag) {
        // name of component
        console.warn("@Cache: vm.$vnode.tag was null");
        return key; // should not happen
    } else {
        // replace auto generated "vue-component-<number>-NAME" with "NAME[key]
        let name = vm.$vnode.tag.replace(/vue-component-\d+-/, "");
        if (name.length == 0) name = vm.$vnode.tag; // unnamed component
        return name + `[${key}]`;
    }
};

/**
 * remove ignored properties before storing
 */
const purgeExceptList = <T>(value: T, except?: string | string[]): T => {
    const newValue = cloneDeep(value);
    if (except && newValue) {
        if (Array.isArray(except)) {
            for (const e of except) {
                delete newValue[e];
            }
        } else {
            delete newValue[except];
        }
    }
    return newValue;
};

/**
 * remove non listed properties before storing
 */
const purgeOnlyList = <T>(value: T, only?: string | string[]): T => {
    const newValue = cloneDeep(value);
    if (only && newValue) {
        const props = Object.getOwnPropertyNames(newValue);
        if (Array.isArray(only)) {
            props.forEach(p => {
                if (!only.find(o => o === p)) {
                    delete newValue[p];
                }
            });
        } else {
            props.forEach(p => p !== only && delete newValue[p]);
        }
    }
    return newValue;
};

/** add properties of b into a inside a new reference */
const merge = <T>(a: T, b: T): T => Object.assign(Object.assign({}, a), b);

/** non object or array types */
const simpleTypes = ["undefined", "number", "string", "boolean"];

/**
 * set the property from localStorage on created() and start watching changes for the property and sync it with the Storage value
 * @param cacheOptions caching options
 * @type <T> type of property to cache(can help in property checking & auto-refactoring)
 */
export default function Cache<T>(cacheOptions?: CacheOptionsWithExcept<T> | CacheOptionsWithOnly<T>) {
    return (target: Vue, key: string): void =>
        createDecorator((options, key) => {
            if (typeof target[key] !== "undefined") {
                console.warn(
                    '@Cache: this decorator can only be applied to class properties.\n         attempted to add @Cache() decorator on field "' +
                        key +
                        '"'
                );
                return;
            }
            if (typeof options.watch !== "object") {
                options.watch = Object.create(null);
            }
            const watch = options.watch as Record<string, unknown>;
            if (typeof watch[key] === "object" && !Array.isArray(watch[key])) {
                watch[key] = [watch[key]];
            } else if (typeof watch[key] === "undefined") {
                watch[key] = [];
            }
            let modifier: <N, T extends N>(v: T) => N;
            if (cacheOptions && cacheOptions["except"] && cacheOptions["only"]) {
                console.error("@Cache: 'except' and 'only' options are mutually exclusive");
            }
            if (cacheOptions && cacheOptions["except"]) {
                modifier = v => purgeExceptList(v, cacheOptions["except"]);
            } else if (cacheOptions && cacheOptions["only"]) {
                modifier = v => purgeOnlyList(v, cacheOptions["only"]);
            } else {
                modifier = v => v;
            }
            let store: Storage;
            if (!cacheOptions?.cacheStore) {
                store = window.localStorage;
            } else {
                store = cacheOptions.cacheStore;
                if (!store["getItem"] || !store["setItem"]) {
                    console.error("@Cache: cacheStore must have getItem and setItem functions");
                }
            }
            // put in array to not override other watchers
            (watch[key] as WatchOptionsWithHandler<unknown>[]).push({
                handler: function (newValue) {
                    if (cacheOptions?.globalDispatch) {
                        window.dispatchEvent(
                            new CustomEvent(cacheOptions.globalDispatch, {
                                detail: newValue
                            })
                        );
                    }
                    store.setItem(makeKey(this, key, cacheOptions), JSON.stringify(modifier(newValue)));
                },
                deep: true,
                immediate: false
            });
            const old = options.created;
            options.created = function () {
                const currentValue = this[key];
                const v = JSON.parse(store.getItem(makeKey(this, key, cacheOptions))) ?? currentValue;
                if (simpleTypes.includes(typeof currentValue) || v === null) {
                    this.$set(this, key, v);
                } else {
                    if (!currentValue) {
                        // just a warning...
                        console.warn(`@Cache: prop [${key}] has no value: ` + currentValue + ", saving as empty object");
                        this.$set(this, key, {});
                    }
                    this.$set(this, key, merge(currentValue, v));
                }
                if (old) old.apply(this);
            };
        })(target, key);
}

type CacheOptions = {
    /**
     * fire a global window event on value change.
     * newValue will be stored in **event.detail** value (on CustomEvent type).
     * event name will be value of this property
     */
    globalDispatch?: string;
    /**
     * if set, the key of the item will be set to this value when storing it,
     * by default this is ${componentName}-[${propertyName}]
     */
    cacheKey?: string;

    /**
     * the cache storage to use for storing the changed value, defaults to window.localStorage
     * @see src/store/MemoryStorage.ts
     */
    cacheStore?: Storage;
};
/**
 * @param <T> type of property to cache
 */
type CacheOptionsWithExcept<T> = {
    /**
     * property or list of properties that should be ignored/not cached
     */
    except?: keyof T | (keyof T)[];
} & CacheOptions;
/**
 * @param <T> type of property to cache
 */
type CacheOptionsWithOnly<T> = {
    /**
     * property or list of properties that only should be cached, other properties wont get cached
     */
    only?: keyof T | (keyof T)[];
} & CacheOptions;
