// 作者：wwj
import { OS_PRESETS } from './os-presets.js';
const letter = '{{random::a::b::c::d::e::f::g::h::i::j::k::l::m::n::o::p::q}}';
const version = '{{roll::1d9}}.{{roll::1d99}}.{{roll::1d9999}}';

export const PRESETS = [
    {
        name: '内部版本',
        headers: ['Internal Version Number', 'Internal Version', 'System Version', 'Software Version',
            'Runtime Version', 'Engine Version', 'Core Version', 'Release Version'],
        mode: 'template',
        templates: [`${version}-${letter}{{roll::1d999}}`,
            `${letter} {{roll::1d9999}} {{roll::1d9999}} {{roll::1d9999}} ${letter} {{roll::1d999}} - {{roll::1d999}}`],
    },
    {
        name: '构建信息',
        headers: ['Build Version', 'Build Number', 'Build Identifier', 'Build Revision',
            'Artifact Version', 'Compilation ID', 'Release Build', 'Package Build ID'],
        mode: 'template',
        templates: [`build-${version}-${letter}${letter}{{roll::1d9999}}`,
            `${letter} {{roll::1d999}} ${letter} ${letter} {{roll::1d9999}} {{roll::1d9999}} {{roll::1d9999}} {{roll::1d9999}}`],
    },
    {
        name: '校验摘要',
        headers: ['Build Fingerprint', 'Artifact Checksum', 'Package Digest', 'Content Fingerprint',
            'Image Digest', 'Manifest Checksum', 'Verification Digest', 'Binary Fingerprint'],
        mode: 'hex', length: 64,
    },
    {
        name: '指令集',
        headers: ['Instruction Set', 'CPU Instruction Set', 'Instruction Set Architecture', 'ISA Profile',
            'Processor Instruction Set', 'Execution ISA', 'Instruction Set Profile', 'ISA Configuration'],
        mode: 'template',
        templates: ['x86-64; SSE2; SSE4.2; AVX; AVX2; revision {{roll::1d999}}',
            'AArch64; NEON; AES; CRC32; revision {{roll::1d999}}',
            'RISC-V RV64GC; profile {{roll::1d99}}.{{roll::1d999}}'],
    },
    {
        name: '序列标识',
        headers: ['Serial Number', 'System Serial', 'Instance Serial', 'Unit Serial Number',
            'Component Serial', 'Module Serial', 'Device Identifier', 'Instance Identifier'],
        mode: 'alnum', length: 40,
    },
    {
        name: '诊断编号',
        headers: ['Test Run ID', 'Diagnostic Run ID', 'Validation Run ID', 'Verification Run ID',
            'Test Session ID', 'Diagnostic Session ID', 'Validation Session ID', 'Test Batch ID'],
        mode: 'alnum', length: 128,
    },
    ...OS_PRESETS,
];

export function presetGroup(index) {
    return { enabled: true, length: 32, templates: ['{{roll::1d9999}}'],
        ...structuredClone(PRESETS[index]) };
}

export function defaultSettings() {
    return {
        schemaVersion: 2, enabled: true, autoRefresh: true, minGroups: 4, maxGroups: 8,
        titles: ['System Information', 'Internal System Information', 'System Metadata',
            'Runtime Metadata', 'System Diagnostics', 'Runtime Information'],
        variableNames: ['system_information', 'system_information_2', 'system_information_3'],
        groups: PRESETS.map((_, index) => presetGroup(index)),
    };
}
