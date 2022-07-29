# What is this?
a typescript decorator that can be used to cache the state of your vue component properties.
the decorator works alongside with vue-class-component and vue2

This can be useful for example to cache a filter property so that when the user leaves the component and comes back the filter is still applied.  

```ts
// table.vue
<template>
    .....
</template>
<script lang="ts">
import Cache from 'vue-cache-decorator'
import Component from "vue-class-component";
import Vue from "vue";

@Component({})
export default class Table extends Vue {
    @Cache()
    filter = {
        categoryId: 0,
        page: 0,
        limit: 10,
        sort: 'createdAt',
    }
}
</script>
```
whenever the user changes the filter, the new value is cached. the next time the user comes back to the component, the old filter value is retrieved from the localStorage.

# Install
```sh
npm install vue-cache-decorator
yarn add vue-cache-decorator
```

# How does it work?
the decorator will create a watcher on the property and when the value changes, the new value is cached in the storage.  
the decorator will also set the old value of the property when the component is created.
the last example is equivalent to the following:
```ts
// table.vue
import Cache from 'vue-cache-decorator'
import Component from "vue-class-component";
import Vue from "vue";

@Component({})
export default class Table extends Vue {
    filter = {}
    
    created() {
        this.filter = JSON.parse(localStorage.getItem('Table-[filter]'))
        this.$watch('filter', {
            handler: (newValue) => {
                localStorage.setItem('Table-[filter]', JSON.stringify(newValue))
            },
            deep: true,
        })
    }
}
```

# Options
the decorator function can accept an options object. the following options are available:
| Option | Description | Type | Default |
|------|-----------|-------|-------|
| `cacheKey` | the storage key for the property when storing/retrieving | `string` | generated value `${componentName}-[${propertyName}]` |
| `deep` | vue deep watch | `boolean` | `true` |
| `cacheStore` | the storage interface to use | `Storage` | `window.localStorage` |
| `except` | property name(s) to ignore | `string\|string[]` | `undefined` |
| `only` | property name(s) only to be cached, mutually exclusive with `except` | `string\|string[]` | `undefined` |
| `globalDispatch` | fire a global window event on value change. newValue will be stored in **event.detail** property (on CustomEvent type). event name will be value of this property | `string` | `undefined` |

the decorator accept one type parameter. this can be used for auto-completion and auto-refactoring for property names in `only` and `except` options.

