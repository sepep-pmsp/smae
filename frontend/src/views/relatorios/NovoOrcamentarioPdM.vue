<script setup>
import { relatórioOrçamentárioPdM as schema } from '@/consts/formSchemas';
import maskMonth from '@/helpers/maskMonth';
import monthAndYearToDate from '@/helpers/monthAndYearToDate';
import { useAlertStore } from '@/stores/alert.store';
// Mantendo comportamento legado
// eslint-disable-next-line import/no-cycle
import { usePdMStore } from '@/stores/pdm.store';
import { useRelatoriosStore } from '@/stores/relatorios.store.ts';
import { Field, Form } from 'vee-validate';
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CheckClose from '../../components/CheckClose.vue';

const alertStore = useAlertStore();
const PdMStore = usePdMStore();
const relatoriosStore = useRelatoriosStore();
const route = useRoute();
const router = useRouter();

const initialValues = computed(() => ({
  fonte: 'Orcamento',
  parametros: {
    tipo: 'Analitico',
    pdm_id: 0,
    meta_id: 0,
    tags: [],
    inicio: '',
    fim: '',
    orgaos: [],
  },
  eh_publico: null,
}));

async function onSubmit(values) {
  const carga = values;
  try {
    carga.parametros.inicio = monthAndYearToDate(carga.parametros.inicio);
    carga.parametros.fim = monthAndYearToDate(carga.parametros.fim);
    const r = await relatoriosStore.insert(carga);
    const msg = 'Relatório em processamento, acompanhe na tela de listagem';

    if (r === true) {
      alertStore.success(msg);
      router.push({ name: route.meta.rotaDeEscape });
    }
  } catch (error) {
    alertStore.error(error);
  }
}

onMounted(() => {
  PdMStore.getAll().then(() => {
    const currentPdM = PdMStore.PdM.find((x) => !!x.ativo);
    if (currentPdM?.id) {
      initialValues.value.parametros.pdm_id = currentPdM.id;
    }
  });
});
</script>

<template>
  <div class="flex spacebetween center mb2">
    <h1>{{ $route.meta.título || $route.name }}</h1>
    <hr class="ml2 f1">
    <CheckClose />
  </div>
  <Form
    v-slot="{ errors, isSubmitting }"
    :validation-schema="schema"
    :initial-values="initialValues"
    @submit="onSubmit"
  >
    <div class="flex g2 mb2">
      <div class="f1">
        <label class="label">
          <abbr title="Programa de metas">PdM</abbr>
          <span class="tvermelho">*</span>
        </label>
        <Field
          name="parametros.pdm_id"
          as="select"
          class="inputtext light
            mb1"
          :class="{ 'error': errors['parametros.pdm_id'] }"
          :disabled="PdMStore.PdM?.loading"
        >
          <option value="">
            Selecionar
          </option>
          <option
            v-for="item in PdMStore.PdM"
            :key="item.id"
            :value="item.id"
          >
            {{ item.nome }}
          </option>
        </Field>
        <div class="error-msg">
          {{ errors['parametros.pdm_id'] }}
        </div>
      </div>
      <div class="f1">
        <label
          for="inicio"
          class="label"
        >mês/ano início <span class="tvermelho">*</span></label>
        <Field
          id="inicio"
          placeholder="01/2003"
          name="parametros.inicio"
          type="text"
          class="inputtext light mb1"
          :class="{ 'error': errors['parametro.inicio'] }"
          maxlength="7"
          @keyup="maskMonth"
        />
        <div class="error-msg">
          {{ errors['parametros.inicio'] }}
        </div>
      </div>
      <div class="f1">
        <label
          for="fim"
          class="label"
        >mês/ano final <span class="tvermelho">*</span></label>
        <Field
          id="fim"
          placeholder="01/2003"
          name="parametros.fim"
          type="text"
          class="inputtext light mb1"
          :class="{ 'error': errors['parametros.fim'] }"
          maxlength="7"
          @keyup="maskMonth"
        />
        <div class="error-msg">
          {{ errors['parametros.fim'] }}
        </div>
      </div>
      <div class="f1">
        <LabelFromYup
          name="eh_publico"
          :schema="schema"
          required
        />
        <Field
          name="eh_publico"
          as="select"
          class="inputtext light"
          :class="{
            error: errors['eh_publico'],
            loading: PdMStore.PdM?.loading
          }"
          :disabled="PdMStore.PdM?.loading"
        >
          <option
            value=""
            disabled
          >
            Selecionar
          </option>
          <option :value="true">
            Sim
          </option>
          <option :value="false">
            Não
          </option>
        </Field>
        <div
          v-if="errors['eh_publico']"
          class="error-msg"
        >
          {{ errors['eh_publico'] }}
        </div>
      </div>
    </div>

    <div class="mb2">
      <label class="block mb1">
        <Field
          name="parametros.tipo"
          type="radio"
          value="Consolidado"
          class="inputcheckbox"
          :class="{ 'error': errors['parametros.tipo'] }"
        />
        <span>Consolidado</span>
      </label>
      <label class="block mb1">
        <Field
          name="parametros.tipo"
          type="radio"
          value="Analitico"
          class="inputcheckbox"
          :class="{ 'error': errors['parametros.tipo'] }"
        />
        <span>Analítico</span>
      </label>
      <div class="error-msg">
        {{ errors['parametros.tipo'] }}
      </div>
    </div>

    <div class="flex spacebetween center mb2">
      <hr class="mr2 f1">
      <button
        type="submit"
        class="btn big"
        :disabled="PdMStore.PdM?.loading ||
          isSubmitting"
      >
        Criar relatório
      </button>
      <hr class="ml2 f1">
    </div>
  </Form>
</template>
