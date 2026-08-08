// ==========================================================================
// components/form.js — Forms described as data
//
// Every editing form on the site is a list of labelled inputs plus a
// cancel/save pair. Declaring the fields means no form has to reach for
// elements by id, and the action buttons cannot end up nested inside a
// collapsed section.
// ==========================================================================

import { fill, h, toggle } from '../core/dom.js';

function control(field, onEnter) {
    const shared = {
        placeholder: field.placeholder,
        onKeydown: field.type === 'textarea' ? null : (e) => {
            if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); }
        },
    };

    if (field.type === 'textarea') {
        return h('textarea', { rows: field.rows || 10, placeholder: field.placeholder });
    }
    if (field.type === 'select') {
        return h('select', {}, field.options.map((option) => {
            const [value, label] = Array.isArray(option) ? option : [option, option];
            return h('option', { value }, label);
        }));
    }
    if (field.type === 'checkbox') {
        return h('input', { type: 'checkbox' });
    }
    return h('input', { type: field.type || 'text', ...shared });
}

function fieldNode(field, controls, onEnter) {
    const input = control(field, onEnter);
    controls.set(field.name, input);

    if (field.type === 'checkbox') {
        return h('div.form-group', {},
            h('label.checkbox-label-inline', {}, input, ` ${field.label}`));
    }
    return h('div.form-group', {}, h('label', {}, field.label), input);
}

function specNode(spec, controls, groups, onEnter) {
    if (spec.row) {
        return h('div.form-row', {}, spec.row.map((f) => fieldNode(f, controls, onEnter)));
    }
    if (spec.group) {
        const node = h('div.reversible-fields-section', {},
            spec.title ? h('h3', {}, spec.title) : null,
            spec.fields.map((f) => specNode(f, controls, groups, onEnter)),
        );
        groups.set(spec.group, node);
        return node;
    }
    return fieldNode(spec, controls, onEnter);
}

/**
 * @param {Array} specs field descriptors; `{row:[...]}` and `{group, fields}` nest
 * @param {{submitText?: string, onSubmit: Function, onCancel: Function, className?: string}} options
 */
export function createForm(specs, { submitText = '保存', onSubmit, onCancel, className = '' }) {
    const controls = new Map();
    const groups = new Map();

    const heading = h('h3');
    const body = h(`form.clean-form-pane${className}`, { onSubmit: (e) => e.preventDefault() },
        specs.map((spec) => specNode(spec, controls, groups, null)),
        h('div.form-actions', {},
            h('button.btn-secondary', { type: 'button', onClick: onCancel }, '取消'),
            h('button.btn-primary', { type: 'button', onClick: onSubmit }, submitText),
        ),
    );

    const root = h('div', {}, h('div.pane-header', {}, heading), body);

    const read = (input) => (input.type === 'checkbox' ? input.checked : input.value.trim());

    return {
        root,

        /** Heading above the form, e.g. 撰写随笔 vs 编辑随笔. */
        setTitle(text) { fill(heading, text); },

        /** Populate; omitted names are cleared so a create form never inherits an edit. */
        setValues(values = {}) {
            for (const [name, input] of controls) {
                const value = values[name];
                if (input.type === 'checkbox') input.checked = !!value;
                else input.value = value === undefined || value === null ? '' : String(value);
            }
        },

        values() {
            return Object.fromEntries([...controls].map(([name, input]) => [name, read(input)]));
        },

        get(name) { return controls.get(name); },

        /** Show or hide a declared group — used by the single/multi volume switch. */
        setGroupVisible(name, isVisible) { toggle(groups.get(name), isVisible); },

        /** React to a control changing, e.g. the reversible checkbox. */
        onChange(name, handler) {
            const input = controls.get(name);
            if (input) input.addEventListener('change', () => handler(read(input)));
        },

        focus(name) { controls.get(name)?.focus(); },
    };
}
