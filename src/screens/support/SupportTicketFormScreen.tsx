import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { categoryOptions, emptyTicket, PRIORITIES, priorityLabel, REQUESTERS, SOURCE_LABEL, STAFF_SOURCES, statusOf, ticketPayload, ticketProblem, typesFor, type Requester, type TicketForm } from '../../lib/support';
import { supportService } from '../../services/support-service';
import { customerService } from '../../services/customer-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Checkbox } from '../../components/ui/Checkbox';
import { Field, Input, SelectField } from '../../components/form/Fields';
import { FormFooter } from '../../components/form/FormFooter';
import { FilterChips, SearchBar } from '../../components/list/ListParts';
import { opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, HelpCircleIcon, UserIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const DELAY_MS = 300;

/** Log a ticket: the store's own request to VeiloScan, or one for a customer or guest who got in touch. */
export function SupportTicketFormScreen({ navigation, route }: ScreenProps<'SupportTicketForm'>) {
  const { t: tr } = useTranslation();
  const relatedTo = route.params?.relatedTo ?? null;
  const { hasPermission } = useAuth();
  const { stores, current } = useStore();
  const toast = useToast();
  const allowed = hasPermission('support-tickets:manage') || hasPermission('support-tickets:create');
  const types = useFetch(() => (allowed ? supportService.ticketTypes() : Promise.resolve([])), [allowed]);
  const categories = useFetch(() => (allowed ? supportService.categories() : Promise.resolve([])), [allowed]);
  const [form, setForm] = useState<TicketForm>(() => emptyTicket(relatedTo?.storeId ?? current?.id ?? '', relatedTo?.id));
  const [related, setRelated] = useState(relatedTo);
  const [linkEarlier, setLinkEarlier] = useState(!!relatedTo);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [ticketQuery, setTicketQuery] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const set = (k: keyof TicketForm) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const t = setTimeout(() => setCustomerSearch(customerQuery.trim()), DELAY_MS);
    return () => clearTimeout(t);
  }, [customerQuery]);
  useEffect(() => {
    const t = setTimeout(() => setTicketSearch(ticketQuery.trim()), DELAY_MS);
    return () => clearTimeout(t);
  }, [ticketQuery]);

  const type = (types.data ?? []).find(t => t.code === form.ticketType);
  const needsOrder = type?.order === 'required';
  const needsRelated = type?.relatedTicket === 'required';
  const showRelated = needsRelated || linkEarlier;
  const shownTypes = typesFor(types.data ?? [], form.requester);
  const categoryChoices = useMemo(() => categoryOptions(categories.data ?? []), [categories.data]);

  const customers = useFetch(
    () => (form.requester === 'account' && hasPermission('customers:manage') ? customerService.list({ page: 1, limit: 50, view: 'all', ...(customerSearch ? { search: customerSearch } : {}) }).then(r => r.items) : Promise.resolve([])),
    [form.requester, customerSearch],
  );
  const orders = useFetch(() => (form.requester === 'account' && form.customerId ? supportService.customerOrders(form.customerId).catch(() => []) : Promise.resolve([])), [form.requester, form.customerId]);
  const matches = useFetch(() => (showRelated && !related && ticketSearch ? supportService.list({ page: 1, limit: 6, search: ticketSearch }).then(r => r.items) : Promise.resolve([])), [showRelated, related, ticketSearch]);

  function chooseType(code: string) {
    const next = (types.data ?? []).find(t => t.code === code);
    setForm(f => ({
      ...f,
      ticketType: code,
      requester: next?.requester === 'store' ? 'store' : f.requester,
      // Category Requests go to the catalogue team.
      categoryId: f.categoryId || (code === 'CATEGORY_REQUEST' ? categoryChoices.find(c => c.code === 'CATALOGUE')?.value ?? '' : ''),
    }));
  }

  function chooseRequester(requester: Requester) {
    setForm(f => {
      const now = (types.data ?? []).find(t => t.code === f.ticketType);
      // A store-only type doesn't fit a customer's ticket.
      return { ...f, requester, customerId: '', orderId: '', ticketType: requester !== 'store' && now?.requester === 'store' ? 'COMPLAINT' : f.ticketType };
    });
  }

  async function save() {
    setError('');
    const problem = ticketProblem({ ...form, relatedTicketId: showRelated && related ? related.id : '' }, type, stores.length > 0);
    if (problem) {
      setError(problem);
      return scroll.current?.scrollToEnd({ animated: true });
    }
    setSaving(true);
    try {
      const created = await supportService.create(ticketPayload({ ...form, relatedTicketId: related?.id ?? '' }, showRelated));
      toast(tr('support.ticketTicketnumberCreated', { ticketNumber: created.ticketNumber }));
      navigation.replace('SupportTicket', { id: created.id });
    } catch (err) {
      setError(extractErrorMessage(err));
      scroll.current?.scrollToEnd({ animated: true });
    } finally {
      setSaving(false);
    }
  }

  const title = relatedTo ? tr('support.followUpToTicketnumber', { ticketNumber: relatedTo.ticketNumber }) : tr('support.newTicket');
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label={tr('common.supportTickets')} icon={HelpCircleIcon} allowed={false} />
      </View>
    );
  }

  const guest = form.requester === 'guest';
  const storeRequest = form.requester === 'store';
  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={title} subtitle={tr('common.supportTickets')} onBack={navigation.goBack} />
      <ScrollView ref={scroll} contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <SectionCard icon={HelpCircleIcon} title={tr('support.ticket')} subtitle={type ? `${type.purpose}.${needsOrder ? ' Needs the order.' : ''}${needsRelated ? ' Needs the earlier ticket.' : ''}` : undefined}>
          <SelectField label={tr('support.ticketType')} required value={form.ticketType} options={shownTypes.map(t => ({ value: t.code, label: t.name }))} onChange={chooseType} />
          <Field label={tr('support.whoIsItFor')}>
            <FilterChips options={REQUESTERS} value={form.requester} onChange={v => chooseRequester(v as Requester)} />
          </Field>
        </SectionCard>

        <SectionCard icon={UserIcon} title={storeRequest ? tr('common.yourStore') : guest ? tr('support.guest') : tr('common.customer')}>
          {storeRequest ? (
            <Text style={styles.info}>
              {tr('support.noCustomerNeededThisGoesTo')}</Text>
          ) : guest ? (
            <>
              <Field label={tr('common.name')}>
                <Input value={form.contactName} onChangeText={set('contactName')} maxLength={150} placeholder={tr('support.theirName')} accessibilityLabel={tr('support.guestName')} />
              </Field>
              <Field label={tr('common.phone')} hint={tr('support.phoneOrEmailHowYouLl')}>
                <Input value={form.contactPhone} onChangeText={set('contactPhone')} maxLength={20} keyboardType="phone-pad" placeholder="+91…" accessibilityLabel={tr('support.guestPhone')} />
              </Field>
              <Field label={tr('common.emailOptional')}>
                <Input value={form.contactEmail} onChangeText={set('contactEmail')} maxLength={255} keyboardType="email-address" autoCapitalize="none" accessibilityLabel={tr('support.guestEmail')} />
              </Field>
              {needsOrder ? <Text style={styles.warn}>{tr('support.thisTicketTypeNeedsAnOrder')}</Text> : null}
            </>
          ) : (
            <>
              <SearchBar value={customerQuery} onChange={setCustomerQuery} placeholder={tr('support.findCustomerByNameEmailOr')} />
              <SelectField
                label={tr('common.customer')}
                required
                value={form.customerId}
                options={(customers.data ?? []).map(c => ({ value: c.id, label: `${[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'} · ${c.email ?? c.phoneNumber ?? ''}` }))}
                onChange={v => setForm(f => ({ ...f, customerId: v, orderId: '' }))}
                placeholder={tr('support.chooseTheCustomer')}
                emptyText={customers.loading ? tr('common.loading') : tr('common.noCustomersMatch')}
              />
              <SelectField
                label={needsOrder ? tr('common.order') : tr('support.relatedOrderOptional')}
                required={needsOrder}
                value={form.orderId}
                options={(orders.data ?? []).map(o => ({ value: String(o.id), label: [String(o.uniqueOrderId ?? o.orderNumber ?? o.id), o.createdAt ? formatDay(o.createdAt) : null].filter(Boolean).join(' · ') }))}
                onChange={set('orderId')}
                placeholder={form.customerId ? (needsOrder ? tr('support.choose') : tr('support.noOrder')) : tr('support.chooseTheCustomerFirst')}
                allowClear={needsOrder ? undefined : tr('support.noOrder')}
                disabled={!form.customerId}
              />
            </>
          )}
        </SectionCard>

        <SectionCard icon={HelpCircleIcon} title={tr('support.routing')}>
          {stores.length ? <SelectField label={tr('common.store')} required value={form.storeId} options={stores.map(s => ({ value: s.id, label: s.name }))} onChange={set('storeId')} placeholder={tr('support.choose')} /> : null}
          <SelectField label={tr('common.category')} required value={form.categoryId} options={categoryChoices} onChange={set('categoryId')} placeholder={tr('support.choose')} />
          <Field label={tr('support.source')}>
            <FilterChips options={STAFF_SOURCES.map(s => ({ value: s, label: SOURCE_LABEL[s] ?? s }))} value={form.source} onChange={set('source')} />
          </Field>
          <Field label={tr('common.priority')}>
            <FilterChips
              options={[{ value: '', label: type?.defaultPriority ? tr('support.defaultDefaultpriority', { defaultPriority: priorityLabel(type.defaultPriority) }) : tr('support.categoryDefault') }, ...PRIORITIES.map(p => ({ value: p, label: priorityLabel(p) }))]}
              value={form.priority}
              onChange={set('priority')}
            />
          </Field>
          {needsRelated ? null : <Checkbox label={tr('support.followsUpAnEarlierTicket')} checked={linkEarlier} onChange={setLinkEarlier} />}
          {showRelated ? (
            related ? (
              <View style={styles.related}>
                <Text style={styles.flex} numberOfLines={2}>
                  <Text style={styles.number}>{related.ticketNumber}</Text>
                  {` · ${related.subject}`}
                </Text>
                {relatedTo ? null : (
                  <Text style={styles.link} onPress={() => setRelated(null)}>
                    {tr('common.change')}</Text>
                )}
              </View>
            ) : (
              <View style={styles.gap}>
                <SearchBar value={ticketQuery} onChange={setTicketQuery} placeholder={tr('support.earlierTicketNumberSubjectOrCustomer')} />
                {(matches.data ?? []).map(m => (
                  <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={tr('support.linkTicketnumber', { ticketNumber: m.ticketNumber })} onPress={() => setRelated({ id: m.id, ticketNumber: m.ticketNumber, subject: m.subject })} style={styles.match}>
                    <Text style={styles.flex} numberOfLines={1}>
                      <Text style={styles.number}>{m.ticketNumber}</Text>
                      {` · ${m.subject}`}
                    </Text>
                    <Text style={opsStyles.muted}>{statusOf(m.status).label}</Text>
                  </Pressable>
                ))}
                {ticketSearch && !matches.loading && !(matches.data ?? []).length ? <Text style={opsStyles.muted}>{tr('support.noTicketsMatch')}</Text> : null}
                <Text style={opsStyles.muted}>{tr('support.theNewTicketTakesItsStore')}</Text>
              </View>
            )
          ) : null}
        </SectionCard>

        <SectionCard icon={HelpCircleIcon} title={tr('support.whatHappened')}>
          <Field label={tr('support.subject')} required>
            <Input
              value={form.subject}
              onChangeText={set('subject')}
              maxLength={200}
              placeholder={form.ticketType === 'CATEGORY_REQUEST' ? tr('support.theCategoryYouNeedEG') : tr('support.shortSummary')}
              accessibilityLabel={tr('support.subject')}
            />
          </Field>
          <Field label={tr('common.description')} required>
            <Input
              value={form.description}
              onChangeText={set('description')}
              multiline
              maxLength={10000}
              style={styles.textArea}
              placeholder={form.ticketType === 'CATEGORY_REQUEST' ? tr('support.theProductsYouWantToList') : storeRequest ? tr('support.whatYouNeedFromVeiloscan') : tr('support.whatTheyReported')}
              accessibilityLabel={tr('common.description')}
            />
          </Field>
        </SectionCard>

        {error ? (
          <View style={opsStyles.error}>
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FormFooter title={tr('support.createTicket')} loading={saving} onSave={save} onCancel={navigation.goBack} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  gap: { gap: 8 },
  content: { gap: 12, paddingBottom: 24 },
  info: { padding: 10, borderRadius: radius.md, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: '#9a3412', backgroundColor: '#fff7ed' },
  warn: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: '#b45309' },
  related: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  match: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  number: { fontFamily: fonts.semibold, color: colors.secondary },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
});
