<script lang="ts" setup>
import { computed } from 'vue';

type ItemLegenda = { item: string, icon?: string };
type Props = {
  titulo?: string,
  legendas: {
    [key in string]: ItemLegenda[]
  },
  orientacao?: 'vertical' | 'horizontal'
};

const props = withDefaults(defineProps<Props>(), {
  titulo: 'Legenda',
  orientacao: 'vertical',
});

const mostrarEmColunas = computed(() => props.orientacao === 'vertical');
</script>

<template>
  <div
    class="lista-legenda flex g2"
    :class="{'column': mostrarEmColunas}"
  >
    <h4 class="lista-legenda__titulo t14 w500">
      {{ $props.titulo }}
    </h4>

    <div class="lista-legenda__conteudo flex column g1">
      <dl
        v-for="(legenda, legendaIndex) in $props.legendas"
        :key="`legenda-item--${legendaIndex}`"
        class="flex g1 flexwrap"
        :class="{ 'column': mostrarEmColunas }"
      >
        <div
          v-for="legendaItem in legenda"
          :key="legendaItem.item"
          class="legenda-item"
        >
          <slot
            :name="`padrao--${legendaIndex}`"
            :item="legendaItem"
          >
            <dt class="legenda-item__icon">
              <svg>
                <use :xlink:href="`#${legendaItem.icon}`" />
              </svg>
            </dt>

            <dd>{{ legendaItem.item }}</dd>
          </slot>
        </div>
      </dl>
    </div>
  </div>
</template>

<style lang="less" scoped>
.lista-legenda {
  border: 1px solid #b8c0cc;
  padding: 10px;
  border-radius: 10px;

  @media screen and (max-width: 55em) {
    flex-direction: column;
  }
}
.lista-legenda__titulo {
  color: #333333;
}

.legenda-item {
  display: inline-flex;
  white-space: wrap;
  gap: 4px;
  height: 20px;
  align-items: center;
  font-size: 10px;
}

.legenda-item :deep(dt) {
  width: 20px;
  height: 100%;
}

.legenda-item__icon svg {
  width: 100%;
  height: 100%;
}

</style>
