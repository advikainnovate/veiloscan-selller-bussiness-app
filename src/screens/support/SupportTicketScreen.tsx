import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { dateTime } from '../../lib/operations';
import { pickImages } from '../../lib/pick-image';
import {
  categoryOptions,
  describeChange,
  EVENT_LABEL,
  formatBytes,
  formatMinutes,
  htmlToText,
  isActiveStatus,
  PRIORITIES,
  PRIORITY_TONE,
  priorityLabel,
  slaState,
  SOURCE_LABEL,
  statusOf,
} from '../../lib/support';
import { supportService, type SupportAttachment, type SupportMessage, type SupportTicketDetail, type TicketStatus } from '../../services/support-service';
import type { PickedFile } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { Group, Row } from '../../components/ui/GroupList';
import { Field, Input, SelectField } from '../../components/form/Fields';
import { ErrorState, FilterChips, ListSkeleton } from '../../components/list/ListParts';
import { opsStyles } from '../../components/operations/OpsParts';
import { AlertCircleIcon, EditIcon, FileTextIcon, HelpCircleIcon, ImageIcon, LockIcon, StarIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { Trans, useTranslation } from 'react-i18next';

type Modal = null | { kind: 'transition'; to: TicketStatus } | { kind: 'resolve' | 'assign' | 'escalate' | 'edit' } | { kind: 'message'; message: SupportMessage } | { kind: 'escalation'; id: string };

const SLA_COLOR = { ok: '#047857', soon: '#b45309', late: colors.error, none: colors.textSecondary };

/** One ticket: what was reported, the conversation, status, assignment, SLA, escalations and files, as the panel's ticket page. */
export function SupportTicketScreen({ navigation, route }: ScreenProps<'SupportTicket'>) {
  const { t: tr } = useTranslation();
  const { id } = route.params;
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('support-tickets:view');
  const { data, error, loading, reload } = useFetch(() => (allowed ? supportService.get(id) : Promise.resolve(null)), [allowed, id]);
  const [modal, setModal] = useState<Modal>(null);
  const [showAudit, setShowAudit] = useState(false);
  const myId = user?.id ? String(user.id) : '';

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast(success);
      setModal(null);
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  const header = <AppHeader title={data?.ticket.ticketNumber ?? tr('support.ticket')} subtitle={tr('common.supportTickets')} onBack={navigation.goBack} />;
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ComingSoon label={tr('common.supportTickets')} icon={HelpCircleIcon} allowed={false} />
      </View>
    );
  }
  if (loading && !data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ListSkeleton rows={4} height={120} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ErrorState message={error || tr('common.notFound')} onRetry={reload} />
      </View>
    );
  }

  const { ticket: t, allowed: can } = data;
  const st = statusOf(t.status);
  const openEscalations = data.escalations.filter(e => e.status === 'OPEN' || e.status === 'ACKNOWLEDGED');
  const response = slaState(t.firstResponseDueAt, t.firstResponseAt, t.firstResponseOverdue);
  const resolution = slaState(t.resolutionDueAt, t.resolvedAt, t.resolutionOverdue);
  const canTake = can.assign && !!myId && t.assignee?.id !== myId && (!t.assignee || can.assignOthers);

  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.secondary} colors={[colors.secondary]} />}>
        <View style={styles.hero}>
          <Text style={styles.subject}>{t.subject}</Text>
          <View style={styles.wrap}>
            <Badge label={st.label} tone={st.tone} />
            <Badge label={`${t.priority === 'URGENT' ? '● ' : ''}${priorityLabel(t.priority)}`} tone={PRIORITY_TONE[t.priority]} />
            <Badge label={t.ticketType.name} tone="slate" />
            {t.customer.isStore ? <Badge label={tr('support.storeRequest')} tone="orange" /> : null}
            {t.customer.isGuest ? <Badge label={tr('support.guest')} tone="slate" /> : null}
            {t.escalationLevel ? <Badge label={tr('support.escalationLevelEscalationlevel', { escalationLevel: t.escalationLevel })} tone="red" /> : null}
            {t.reopenCount ? <Badge label={tr('support.reopenedReopencount', { reopenCount: t.reopenCount })} tone="amber" /> : null}
          </View>
        </View>

        {can.transitions.length || can.edit || (can.escalate && isActiveStatus(t.status)) ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
            {can.transitions.map(to => (
              <Pressable
                key={to}
                accessibilityRole="button"
                onPress={() => setModal(to === 'RESOLVED' ? { kind: 'resolve' } : { kind: 'transition', to })}
                style={[opsStyles.smallBtn, to === 'RESOLVED' && styles.resolveBtn]}
              >
                <Text style={[opsStyles.smallBtnText, to === 'RESOLVED' && styles.white]}>{to === 'RESOLVED' ? tr('support.resolve') : statusOf(to).label}</Text>
              </Pressable>
            ))}
            {can.escalate && isActiveStatus(t.status) ? (
              <Pressable accessibilityRole="button" onPress={() => setModal({ kind: 'escalate' })} style={[opsStyles.smallBtn, styles.escalateBtn]}>
                <AlertCircleIcon size={14} color={colors.error} />
                <Text style={[opsStyles.smallBtnText, opsStyles.danger]}>{tr('support.escalate')}</Text>
              </Pressable>
            ) : null}
            {can.edit ? (
              <Pressable accessibilityRole="button" onPress={() => setModal({ kind: 'edit' })} style={opsStyles.smallBtn}>
                <EditIcon size={14} color={colors.text} />
                <Text style={opsStyles.smallBtnText}>{tr('common.edit')}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}

        <Group title={t.customer.isStore ? tr('support.theStoreSRequest') : tr('support.customerSReport')}>
          <View style={styles.block}>
            <Text style={styles.body}>{htmlToText(t.description) || '—'}</Text>
            {t.resolutionSummary ? (
              <View style={styles.resolution}>
                <Text style={styles.resolutionLabel}>{tr('support.resolution')}</Text>
                <Text style={styles.resolutionText}>{t.resolutionSummary}</Text>
              </View>
            ) : null}
          </View>
        </Group>

        <Group title="CONVERSATION">
          <View style={styles.block}>
            <Conversation messages={data.messages} myId={myId} canEdit={can.edit} ticketId={id} onEdit={m => setModal({ kind: 'message', message: m })} />
            {can.reply || can.internalNote ? (
              <Composer key={data.messages.length} ticketId={id} detail={data} onSent={reload} />
            ) : (
              <Text style={[opsStyles.muted, styles.readOnly]}>{t.status === 'CLOSED' ? tr('support.thisTicketIsClosedReopenIt') : tr('support.youHaveReadOnlyAccessTo')}</Text>
            )}
          </View>
        </Group>

        <Group title="DETAILS">
          <Row label={t.customer.isStore ? tr('support.requestedBy') : t.customer.isGuest ? tr('support.guest') : tr('common.customer')} value={t.customer.name ?? '—'} />
          {t.customer.isStore && t.raisedBy ? <Row label={tr('support.raisedBy')} value={t.raisedBy.name ?? '—'} /> : null}
          <Row label={tr('common.email')} value={t.customer.email ?? '—'} />
          <Row label={tr('common.phone')} value={t.customer.phone ?? '—'} />
          <Row label={tr('common.store')} value={t.store?.name ?? 'Platform (VeiloScan)'} />
          <Row
            label={tr('common.order')}
            value={
              t.order ? (
                hasPermission('orders:manage') ? (
                  <Text style={styles.link} onPress={() => navigation.navigate('OrderDetail', { id: t.order!.id })}>
                    {t.order.orderNumber}
                  </Text>
                ) : (
                  t.order.orderNumber
                )
              ) : (
                '—'
              )
            }
          />
          <Row label={tr('common.category')} value={t.category?.name ?? '—'} />
          <Row label={tr('support.source')} value={SOURCE_LABEL[t.source] ?? t.source} />
          {t.preferredContactChannel ? <Row label={tr('support.prefers')} value={t.preferredContactChannel} /> : null}
          <Row label={tr('common.created')} value={dateTime(t.createdAt)} last={!t.closedAt} />
          {t.closedAt ? <Row label={tr('common.closed')} value={dateTime(t.closedAt)} last /> : null}
        </Group>

        <Group title="SLA">
          {t.slaPolicy ? (
            <>
              <Row label={tr('support.policy')} value={`${t.slaPolicy.name} · ${t.slaPolicy.businessHoursOnly ? 'business hours' : '24/7'}`} />
              <Row label={tr('support.targets')} value={`${formatMinutes(t.slaPolicy.firstResponseMinutes)} / ${formatMinutes(t.slaPolicy.resolutionMinutes)}`} />
              <Row label={tr('support.firstResponse')} value={<Text style={[styles.sla, { color: SLA_COLOR[response.tone] }]}>{response.text}</Text>} />
              <Row label={tr('support.resolution2')} value={<Text style={[styles.sla, { color: SLA_COLOR[resolution.tone] }]}>{resolution.text}</Text>} last />
            </>
          ) : (
            <Row label={tr('support.policy')} value={tr('support.noneForPriority', { priority: priorityLabel(t.priority) })} last />
          )}
        </Group>

        <Group title="ASSIGNMENT" action={can.assign ? { label: tr('common.change'), onPress: () => setModal({ kind: 'assign' }) } : undefined}>
          <View style={styles.block}>
            <View style={opsStyles.rowBetween}>
              <View style={styles.flex}>
                <Text style={opsStyles.title}>{t.assignee?.name ?? tr('support.unassigned')}</Text>
                {t.assignedTeam ? <Text style={opsStyles.meta}>{tr('support.teamAssignedteam', { assignedTeam: t.assignedTeam })}</Text> : null}
              </View>
              {canTake ? (
                <Pressable accessibilityRole="button" onPress={() => run(() => supportService.assign(id, { assignedTo: myId }), tr('support.assignedToYou'))} style={opsStyles.smallBtn}>
                  <Text style={opsStyles.smallBtnText}>{tr('support.takeIt')}</Text>
                </Pressable>
              ) : null}
            </View>
            {data.assignments.map(a => (
              <Text key={a.id} style={[opsStyles.meta, a.unassignedAt && styles.faded]}>
                {`${a.assignee?.name ?? a.assignedTeam ?? '—'}${a.assignee && a.assignedTeam ? ` · ${a.assignedTeam}` : ''} — ${dateTime(a.assignedAt)}${a.assignedBy ? ` by ${a.assignedBy.name}` : ''}${a.note ? ` · “${a.note}”` : ''}`}
              </Text>
            ))}
          </View>
        </Group>

        {data.escalations.length ? (
          <Group title={openEscalations.length ? tr('support.escalationsOpen', { count: openEscalations.length }) : tr('support.escalations')}>
            <View style={styles.block}>
              {data.escalations.map(e => (
                <View key={e.id} style={styles.escalation}>
                  <View style={opsStyles.rowBetween}>
                    <Text style={opsStyles.title}>{`${tr('support.levelNumber', { level: e.level })}${e.isAutomatic ? ` · ${tr('support.automatic')}` : ''}`}</Text>
                    <Badge label={e.status.charAt(0) + e.status.slice(1).toLowerCase()} tone={e.status === 'RESOLVED' ? 'green' : e.status === 'CANCELLED' ? 'slate' : e.status === 'ACKNOWLEDGED' ? 'amber' : 'red'} />
                  </View>
                  <Text style={styles.body}>{e.reason}</Text>
                  <Text style={opsStyles.meta}>{`${e.escalatedBy?.name ?? 'System'} → ${e.escalatedTo?.name ?? e.escalatedTeam ?? 'VeiloScan support'} · ${dateTime(e.escalatedAt)}`}</Text>
                  {e.resolutionNote ? <Text style={opsStyles.meta}>{`“${e.resolutionNote}”`}</Text> : null}
                  {can.escalate && (e.status === 'OPEN' || e.status === 'ACKNOWLEDGED') ? (
                    <View style={styles.inline}>
                      {e.status === 'OPEN' ? (
                        <Text style={styles.link} onPress={() => run(() => supportService.updateEscalation(id, e.id, 'ACKNOWLEDGED'), tr('support.escalationAcknowledged'))}>
                          {tr('support.acknowledge')}</Text>
                      ) : null}
                      <Text style={styles.link} onPress={() => setModal({ kind: 'escalation', id: e.id })}>
                        {tr('support.resolve')}</Text>
                      <Text style={[styles.link, styles.muted]} onPress={() => run(() => supportService.updateEscalation(id, e.id, 'CANCELLED'), tr('support.escalationCancelled'))}>
                        {tr('common.cancel')}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </Group>
        ) : null}

        <Group title={tr('support.filesAttachmentscount', { attachmentsCount: data.attachments.length })}>
          <View style={styles.block}>
            {data.attachments.length ? data.attachments.map(a => <AttachmentRow key={a.id} ticketId={id} attachment={a} />) : <Text style={opsStyles.muted}>{tr('support.noFilesYet')}</Text>}
          </View>
        </Group>

        <Group title={tr('support.linkedTickets')} action={can.assign ? { label: tr('support.logFollowUp'), onPress: () => navigation.navigate('SupportTicketForm', { relatedTo: { id: t.id, ticketNumber: t.ticketNumber, subject: t.subject, storeId: t.store?.id } }) } : undefined}>
          <View style={styles.block}>
            {t.relatedTicket || data.followUps.length ? (
              <>
                {t.relatedTicket ? (
                  <Text style={opsStyles.meta}>
                    <Trans
                      i18nKey="support.followsTicket"
                      values={{ number: t.relatedTicket.ticketNumber }}
                      components={{ link: <Text style={styles.link} onPress={() => navigation.push('SupportTicket', { id: t.relatedTicket!.id })} /> }}
                    />
                    {` · ${t.relatedTicket.subject} (${statusOf(t.relatedTicket.status).label})`}
                  </Text>
                ) : null}
                {data.followUps.map(f => (
                  <Text key={f.id} style={opsStyles.meta}>
                    {`${f.ticketType?.name ?? 'Follow-up'} `}
                    <Text style={styles.link} onPress={() => navigation.push('SupportTicket', { id: f.id })}>
                      {f.ticketNumber}
                    </Text>
                    {` · ${f.subject} (${statusOf(f.status).label})`}
                  </Text>
                ))}
              </>
            ) : (
              <Text style={opsStyles.muted}>{tr('support.noEarlierOrFollowUpTickets')}</Text>
            )}
          </View>
        </Group>

        {data.feedback ? (
          <Group title={tr('support.customerFeedback')}>
            <View style={styles.block}>
              <View style={styles.stars}>
                {Array.from({ length: 5 }, (_, i) => (
                  <StarIcon key={i} size={16} color={i < data.feedback!.rating ? '#f59e0b' : colors.border} />
                ))}
                <Text style={opsStyles.title}>{` ${data.feedback.rating}/5`}</Text>
              </View>
              {data.feedback.comments ? <Text style={styles.body}>{data.feedback.comments}</Text> : null}
              <Text style={opsStyles.muted}>{dateTime(data.feedback.submittedAt)}</Text>
            </View>
          </Group>
        ) : null}

        {can.viewAudit && data.events ? (
          <Group title={tr('support.auditTrail')} action={{ label: showAudit ? tr('support.hide') : tr('support.showEventscount', { eventsCount: data.events.length }), onPress: () => setShowAudit(v => !v) }}>
            <View style={styles.block}>
              {showAudit ? (
                data.events.map(e => (
                  <View key={e.id} style={styles.event}>
                    <View style={opsStyles.rowBetween}>
                      <Text style={opsStyles.title}>{EVENT_LABEL[e.eventType] ?? e.eventType}</Text>
                      <Text style={opsStyles.muted}>{dateTime(e.createdAt)}</Text>
                    </View>
                    <Text style={opsStyles.meta}>
                      {`${e.actor ? `${e.actor.name ?? '—'}${e.actor.isCustomer ? ' (customer)' : ''}` : 'System'}${e.oldValue || e.newValue ? ` · ${describeChange(e.oldValue, e.newValue)}` : ''}`}
                    </Text>
                    {e.note ? <Text style={opsStyles.meta}>{`“${e.note}”`}</Text> : null}
                  </View>
                ))
              ) : (
                <Text style={opsStyles.muted}>{tr('support.everyStatusPriorityAssignmentAndFile')}</Text>
              )}
            </View>
          </Group>
        ) : null}
      </ScrollView>

      <TextSheet
        visible={modal?.kind === 'transition'}
        title={modal?.kind === 'transition' ? tr('support.moveToLabel', { label: statusOf(modal.to).label }) : ''}
        label={tr('support.reasonAuditTrailNotShownTo')}
        confirmLabel={tr('common.changeStatus')}
        onClose={() => setModal(null)}
        onConfirm={reason => modal?.kind === 'transition' && run(() => supportService.transition(id, modal.to, { reason: reason || undefined }), tr('support.statusChangedToLabel', { label: statusOf(modal.to).label }))}
      />
      <TextSheet
        visible={modal?.kind === 'resolve'}
        title={tr('support.resolveTicket')}
        message={tr('support.openEscalationsAreClosedWithIt')}
        label={tr('support.resolutionSummaryShownToTheCustomer')}
        initial={t.resolutionSummary ?? ''}
        confirmLabel={tr('support.resolve')}
        onClose={() => setModal(null)}
        onConfirm={summary => run(() => supportService.transition(id, 'RESOLVED', { resolutionSummary: summary || undefined }), tr('support.ticketResolvedTheCustomerIsAsked'))}
      />
      <TextSheet
        visible={modal?.kind === 'message'}
        title={tr('support.editMessage')}
        message={tr('support.theOriginalIsKeptInThe')}
        label={tr('support.message')}
        initial={modal?.kind === 'message' ? modal.message.body : ''}
        required
        confirmLabel={tr('common.save')}
        onClose={() => setModal(null)}
        onConfirm={body => modal?.kind === 'message' && run(() => supportService.editMessage(id, modal.message.id, body), tr('support.messageUpdated'))}
      />
      <TextSheet
        visible={modal?.kind === 'escalation'}
        title={tr('support.resolveEscalation')}
        label={tr('support.outcome')}
        confirmLabel={tr('support.resolve')}
        onClose={() => setModal(null)}
        onConfirm={note => modal?.kind === 'escalation' && run(() => supportService.updateEscalation(id, modal.id, 'RESOLVED', note || undefined), tr('support.escalationResolved'))}
      />
      <AssignSheet visible={modal?.kind === 'assign'} detail={data} onClose={() => setModal(null)} onSave={payload => run(() => supportService.assign(id, payload), tr('support.assignmentUpdated'))} />
      <EscalateSheet visible={modal?.kind === 'escalate'} detail={data} onClose={() => setModal(null)} onSave={payload => run(() => supportService.escalate(id, payload), tr('support.ticketEscalated'))} />
      <EditSheet visible={modal?.kind === 'edit'} detail={data} onClose={() => setModal(null)} onSave={payload => run(() => supportService.update(id, payload), tr('support.ticketUpdated'))} />
    </KeyboardAvoidingView>
  );
}

function Conversation({ messages, myId, canEdit, ticketId, onEdit }: { messages: SupportMessage[]; myId: string; canEdit: boolean; ticketId: string; onEdit: (m: SupportMessage) => void }) {
  const { t } = useTranslation();
  if (!messages.length) return <Text style={opsStyles.muted}>{t('support.noMessagesYet')}</Text>;
  return (
    <View style={styles.messages}>
      {messages.map(m => {
        if (m.messageType === 'SYSTEM_EVENT') {
          return (
            <Text key={m.id} style={[opsStyles.muted, styles.system]}>
              {`${m.body} · ${dateTime(m.createdAt)}`}
            </Text>
          );
        }
        const note = m.messageType === 'INTERNAL_NOTE';
        return (
          <View key={m.id} style={[styles.bubble, m.fromCustomer ? styles.fromCustomer : note ? styles.note : styles.fromStaff]}>
            <View style={styles.bubbleHead}>
              <Text style={styles.author}>{m.author?.name ?? (m.fromCustomer ? t('common.customer') : t('support.staff'))}</Text>
              {note ? (
                <View style={styles.noteTag}>
                  <LockIcon size={11} color="#92400e" />
                  <Text style={styles.noteTagText}>{m.internalAudience === 'STORE' ? t('support.internalStoreVeiloscan') : t('support.internalVeiloscanOnly')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.body}>{m.body}</Text>
            {m.attachments.map(a => (
              <AttachmentRow key={a.id} ticketId={ticketId} attachment={a} />
            ))}
            <View style={styles.inline}>
              <Text style={opsStyles.muted}>{`${dateTime(m.createdAt)}${m.channel !== 'PORTAL' ? ` · ${t('support.viaChannel', { channel: m.channel.toLowerCase() })}` : ''}${m.editedAt ? ` · ${t('support.edited')}` : ''}`}</Text>
              {canEdit && m.author?.id === myId && !m.fromCustomer ? (
                <Text style={styles.link} onPress={() => onEdit(m)}>
                  {t('common.edit')}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function AttachmentRow({ ticketId, attachment: a }: { ticketId: string; attachment: SupportAttachment }) {
  const { t } = useTranslation();
  const toast = useToast();
  async function open() {
    try {
      // Links are signed per tap and expire within minutes.
      const { url } = await supportService.downloadUrl(ticketId, a.id);
      await Linking.openURL(url);
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('support.openFilename', { fileName: a.fileName })} onPress={open} style={styles.file}>
      <FileTextIcon size={16} color={colors.secondary} />
      <View style={styles.flex}>
        <Text style={opsStyles.title} numberOfLines={1}>
          {a.fileName}
        </Text>
        <Text style={opsStyles.muted}>
          {`${formatBytes(a.sizeBytes)}${a.uploadedByCustomer ? ` · ${t('support.fromCustomer')}` : ''}${!a.isCustomerVisible ? ` · ${a.internalAudience === 'STORE' ? t('support.internalStore') : t('support.internalVeiloscan')}` : ''}`}
        </Text>
      </View>
    </Pressable>
  );
}

// A store team's notes are always shared with the team and VeiloScan (the API sets it).
function Composer({ ticketId, detail, onSent }: { ticketId: string; detail: SupportTicketDetail; onSent: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const can = detail.allowed;
  const isStoreRequest = detail.ticket.customer.isStore;
  const replyTo = isStoreRequest ? t('support.veiloscanSupport') : t('support.theCustomer');
  const [mode, setMode] = useState<'REPLY' | 'INTERNAL_NOTE'>(can.reply ? 'REPLY' : 'INTERNAL_NOTE');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [sending, setSending] = useState(false);
  const note = mode === 'INTERNAL_NOTE';
  const modes = [
    ...(can.reply ? [{ value: 'REPLY', label: isStoreRequest ? t('support.messageVeiloscan') : t('support.replyToCustomer') }] : []),
    ...(can.internalNote ? [{ value: 'INTERNAL_NOTE', label: t('support.internalNote') }] : []),
  ];

  async function attach() {
    try {
      const picked = await pickImages();
      setFiles(f => [...f, ...picked].slice(0, 5));
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function send() {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const message = await supportService.addMessage(ticketId, { messageType: mode, body: body.trim() });
      const failed: string[] = [];
      for (const file of files) {
        try {
          await supportService.upload(ticketId, file, { messageId: message.id, visibility: note ? 'INTERNAL' : 'PUBLIC' });
        } catch (err) {
          failed.push(`${file.name}: ${extractErrorMessage(err)}`);
        }
      }
      setBody('');
      setFiles([]);
      if (failed.length) toast(t('support.sentButSomeFilesFailedJoin', { join: failed.join('; ') }), 'error');
      else toast(note ? t('support.internalNoteAdded') : t('support.replySentToReplyto', { replyTo }));
      onSent();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.composer, note && styles.composerNote]}>
      {modes.length > 1 ? <FilterChips options={modes} value={mode} onChange={v => setMode(v as typeof mode)} /> : null}
      {note ? <Text style={styles.noteHint}>{t('support.seenByYourStoreTeamAnd')}</Text> : null}
      <Input
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={10000}
        style={styles.textArea}
        placeholder={note ? t('support.forYourTeamAndVeiloscanNever') : t('support.writeAReplyReplytoIsNotified', { replyTo })}
        accessibilityLabel={note ? t('support.internalNote') : t('support.reply')}
      />
      {files.length ? (
        <View style={styles.wrap}>
          {files.map((f, i) => (
            <Text key={`${f.uri}${i}`} style={styles.fileChip} onPress={() => setFiles(x => x.filter((_, j) => j !== i))}>
              {`${f.name}${f.fileSize ? ` (${formatBytes(f.fileSize)})` : ''}  ✕`}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={opsStyles.rowBetween}>
        <Pressable accessibilityRole="button" onPress={attach} style={styles.attach} hitSlop={6}>
          <ImageIcon size={16} color={colors.textSecondary} />
          <Text style={opsStyles.smallBtnText}>{t('support.attachPhotos')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!body.trim() || sending} onPress={send} style={[opsStyles.primaryBtn, note && styles.noteBtn, (!body.trim() || sending) && styles.disabled]}>
          <Text style={opsStyles.primaryBtnText}>{sending ? t('common.sending') : note ? t('support.addNote') : t('support.sendReply')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** One text box in a sheet (a reason, a summary, an edited message). */
function TextSheet({
  visible,
  title,
  message,
  label,
  initial = '',
  required,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  label: string;
  initial?: string;
  required?: boolean;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (text: string) => unknown;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) setText(initial);
  }, [visible, initial]);
  const blocked = busy || (!!required && !text.trim());
  return (
    <Sheet
      visible={visible}
      title={title}
      subtitle={message}
      onClose={onClose}
      footer={
        <Pressable
          accessibilityRole="button"
          disabled={blocked}
          onPress={async () => {
            setBusy(true);
            try {
              await onConfirm(text.trim());
            } finally {
              setBusy(false);
            }
          }}
          style={[opsStyles.primaryBtn, blocked && styles.disabled]}
        >
          <Text style={opsStyles.primaryBtnText}>{busy ? t('common.saving') : confirmLabel}</Text>
        </Pressable>
      }
    >
      <Field label={label} required={required}>
        <Input value={text} onChangeText={setText} multiline maxLength={10000} style={styles.textArea} accessibilityLabel={label} />
      </Field>
    </Sheet>
  );
}

function SaveButton({ label, busy, danger, onPress }: { label: string; busy: boolean; danger?: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={[opsStyles.primaryBtn, danger && styles.dangerBtn, busy && styles.disabled]}>
      <Text style={opsStyles.primaryBtnText}>{busy ? t('common.saving') : label}</Text>
    </Pressable>
  );
}

function useBusy() {
  const [busy, setBusy] = useState(false);
  const wrap = (fn: () => unknown) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return [busy, wrap] as const;
}

function AssignSheet({ visible, detail, onClose, onSave }: { visible: boolean; detail: SupportTicketDetail; onClose: () => void; onSave: (p: { assignedTo: string | null; assignedTeam: string | null; note?: string }) => unknown }) {
  const { t: tr } = useTranslation();
  const t = detail.ticket;
  const people = useFetch(() => (visible ? supportService.assignees(t.id) : Promise.resolve([])), [visible, t.id]);
  const [assignedTo, setAssignedTo] = useState('');
  const [team, setTeam] = useState('');
  const [note, setNote] = useState('');
  const [busy, wrap] = useBusy();
  useEffect(() => {
    if (!visible) return;
    setAssignedTo(t.assignee?.id ?? '');
    setTeam(t.assignedTeam ?? '');
    setNote('');
  }, [visible, t.assignee?.id, t.assignedTeam]);
  return (
    <Sheet
      visible={visible}
      title={tr('support.assignTicket')}
      subtitle={tr('support.previousAssignmentsStayInTheHistory')}
      onClose={onClose}
      footer={<SaveButton label={tr('common.save')} busy={busy} onPress={wrap(() => onSave({ assignedTo: assignedTo || null, assignedTeam: team.trim() || null, note: note.trim() || undefined }))} />}
    >
      <View style={styles.sheet}>
        <SelectField
          label={tr('support.agent')}
          value={assignedTo}
          options={(people.data ?? []).map(p => ({ value: p.id, label: p.name ?? p.email ?? '—' }))}
          onChange={setAssignedTo}
          placeholder={tr('support.unassigned')}
          allowClear={tr('support.unassigned')}
          hint={detail.allowed.assignOthers ? undefined : tr('support.withoutSupervisorAccessYouCanOnly')}
        />
        <Field label={tr('support.team')}>
          <Input value={team} onChangeText={setTeam} maxLength={100} placeholder="e.g. Counter, Returns" accessibilityLabel={tr('support.team')} />
        </Field>
        <Field label={tr('common.noteOptional')}>
          <Input value={note} onChangeText={setNote} multiline maxLength={1000} accessibilityLabel={tr('support.assignmentNote')} />
        </Field>
      </View>
    </Sheet>
  );
}

function EscalateSheet({ visible, detail, onClose, onSave }: { visible: boolean; detail: SupportTicketDetail; onClose: () => void; onSave: (p: { reason: string; level: number; escalatedTo?: string; escalatedTeam?: string }) => unknown }) {
  const { t: tr } = useTranslation();
  const t = detail.ticket;
  const nextLevel = Math.min((t.escalationLevel ?? 0) + 1, 5);
  const people = useFetch(() => (visible ? supportService.assignees(t.id) : Promise.resolve([])), [visible, t.id]);
  const [reason, setReason] = useState('');
  const [level, setLevel] = useState(String(nextLevel));
  const [to, setTo] = useState('');
  const [team, setTeam] = useState('');
  const [busy, wrap] = useBusy();
  useEffect(() => {
    if (!visible) return;
    setReason('');
    setLevel(String(nextLevel));
    setTo('');
    setTeam('');
  }, [visible, nextLevel]);
  return (
    <Sheet
      visible={visible}
      title={tr('support.escalateTicket')}
      onClose={onClose}
      footer={<SaveButton label={tr('support.escalate')} danger busy={busy || !reason.trim()} onPress={wrap(() => onSave({ reason: reason.trim(), level: Number(level), escalatedTo: to || undefined, escalatedTeam: team.trim() || undefined }))} />}
    >
      <View style={styles.sheet}>
        <Field label={tr('common.reason')} required>
          <Input value={reason} onChangeText={setReason} multiline maxLength={2000} placeholder={tr('support.whyThisNeedsMoreSeniorAttention')} accessibilityLabel={tr('support.escalationReason')} />
        </Field>
        <Field label={tr('support.level')}>
          <FilterChips options={[1, 2, 3, 4, 5].filter(l => l >= nextLevel).map(l => ({ value: String(l), label: tr('support.levelL', { l }) }))} value={level} onChange={setLevel} />
        </Field>
        <SelectField
          label={tr('support.escalateToOptional')}
          hint={tr('support.leaveEmptyToRaiseItWith')}
          value={to}
          options={(people.data ?? []).map(p => ({ value: p.id, label: `${p.name ?? '—'} ${p.isPlatform ? '· VeiloScan' : '· store team'}` }))}
          onChange={setTo}
          placeholder={tr('support.veiloscanSupport')}
          allowClear={tr('support.veiloscanSupport')}
        />
        <Field label={tr('support.team')}>
          <Input value={team} onChangeText={setTeam} maxLength={100} placeholder={tr('support.veiloscanSupport2')} accessibilityLabel={tr('support.escalationTeam')} />
        </Field>
      </View>
    </Sheet>
  );
}

function EditSheet({ visible, detail, onClose, onSave }: { visible: boolean; detail: SupportTicketDetail; onClose: () => void; onSave: (p: Record<string, unknown>) => unknown }) {
  const { t: tr } = useTranslation();
  const t = detail.ticket;
  const types = useFetch(() => (visible ? supportService.ticketTypes() : Promise.resolve([])), [visible]);
  const categories = useFetch(() => (visible ? supportService.categories() : Promise.resolve([])), [visible]);
  const [form, setForm] = useState({ subject: t.subject, ticketType: t.ticketType.code, categoryId: t.category?.id ?? '', priority: t.priority as string, reason: '' });
  const [busy, wrap] = useBusy();
  useEffect(() => {
    if (visible) setForm({ subject: t.subject, ticketType: t.ticketType.code, categoryId: t.category?.id ?? '', priority: t.priority, reason: '' });
  }, [visible, t.subject, t.ticketType.code, t.category?.id, t.priority]);
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  function save() {
    const payload: Record<string, unknown> = {};
    if (form.subject.trim() && form.subject.trim() !== t.subject) payload.subject = form.subject.trim();
    if (form.categoryId && form.categoryId !== t.category?.id) payload.categoryId = form.categoryId;
    if (form.priority !== t.priority) payload.priority = form.priority;
    if (form.ticketType !== t.ticketType.code) payload.ticketType = form.ticketType;
    if (!Object.keys(payload).length) return onClose();
    if (form.reason.trim()) payload.reason = form.reason.trim();
    return onSave(payload);
  }

  return (
    <Sheet visible={visible} title={tr('support.editTicket')} onClose={onClose} footer={<SaveButton label={tr('common.save')} busy={busy} onPress={wrap(save)} />}>
      <View style={styles.sheet}>
        <Field label={tr('support.subject')}>
          <Input value={form.subject} onChangeText={set('subject')} maxLength={200} accessibilityLabel={tr('support.subject')} />
        </Field>
        <SelectField label={tr('support.ticketType')} value={form.ticketType} options={(types.data ?? []).map(x => ({ value: x.code, label: x.name }))} onChange={set('ticketType')} />
        <SelectField label={tr('common.category')} value={form.categoryId} options={categoryOptions(categories.data ?? [])} onChange={set('categoryId')} />
        <Field label={tr('common.priority')} hint={tr('support.changingItRecalculatesTheSlaDeadlines')}>
          <FilterChips options={PRIORITIES.map(p => ({ value: p, label: priorityLabel(p) }))} value={form.priority} onChange={set('priority')} />
        </Field>
        <Field label={tr('support.reasonAuditTrail')}>
          <Input value={form.reason} onChangeText={set('reason')} multiline maxLength={1000} accessibilityLabel={tr('support.editReason')} />
        </Field>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  white: { color: colors.white },
  muted: { color: colors.textSecondary },
  faded: { color: colors.textMuted },
  content: { gap: 16, padding: 16, paddingBottom: 40 },
  hero: { gap: 8 },
  subject: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.3, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { gap: 8, paddingRight: 8 },
  resolveBtn: { borderColor: colors.success, backgroundColor: colors.success },
  escalateBtn: { borderColor: '#fecaca', backgroundColor: colors.errorLight },
  block: { gap: 10, paddingVertical: 12 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  resolution: { gap: 4, padding: 10, borderRadius: radius.md, backgroundColor: colors.successLight },
  resolutionLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, color: colors.successDark },
  resolutionText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.successDark },
  readOnly: { paddingVertical: 4 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  sla: { fontFamily: fonts.semibold, fontSize: 13.5 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  escalation: { gap: 4, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  event: { gap: 2, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  messages: { gap: 10 },
  system: { textAlign: 'center' },
  bubble: { maxWidth: '94%', gap: 6, padding: 10, borderRadius: 14, borderWidth: 1 },
  fromCustomer: { alignSelf: 'flex-start', borderColor: colors.border, backgroundColor: colors.background },
  fromStaff: { alignSelf: 'flex-end', borderColor: '#ffe4cc', backgroundColor: '#fff8f2' },
  note: { alignSelf: 'flex-end', borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  bubbleHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  author: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  noteTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#fde68a' },
  noteTagText: { fontFamily: fonts.semibold, fontSize: 10.5, color: '#92400e' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  composer: { gap: 10, marginTop: 4, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  composerNote: { borderColor: '#fde68a', backgroundColor: '#fffdf5' },
  noteHint: { fontFamily: fonts.medium, fontSize: 12, color: '#92400e' },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  fileChip: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, backgroundColor: colors.background },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteBtn: { backgroundColor: '#d97706' },
  dangerBtn: { backgroundColor: colors.error },
  disabled: { opacity: 0.5 },
  sheet: { gap: 14 },
});
