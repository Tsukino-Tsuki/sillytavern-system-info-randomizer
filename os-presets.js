// 作者：wwj；合成字段，名称参考 systemd、Linux kernel 与 Microsoft 官方系统信息文档。
export const OS_PRESETS = [
    {
        name: 'Linux 发行版', mode: 'template',
        headers: ['Linux Distribution ID', 'Linux OS ID', 'Linux Distribution', 'Linux Distro ID'],
        templates: ['{{random::debian::ubuntu::fedora::arch::alpine::opensuse}}'],
    },
    {
        name: 'Linux 内核版本', mode: 'template',
        headers: ['Linux Kernel Release', 'Linux Kernel Version', 'Linux OS Release', 'Linux Kernel Revision'],
        templates: ['{{random::5::6}}.{{roll::1d19}}.{{roll::1d199}}-{{random::generic::lts::rt}}'],
    },
    {
        name: 'Linux 架构', mode: 'template',
        headers: ['Linux Machine Architecture', 'Linux Kernel Architecture', 'Linux CPU Architecture', 'Linux Hardware Architecture'],
        templates: ['{{random::x86_64::aarch64::armv7l::riscv64}}'],
    },
    {
        name: 'Linux 机器标识', mode: 'hex', length: 32,
        headers: ['Linux Machine ID', 'Linux System Machine ID', 'Linux Host Machine ID', 'Linux Machine Identifier'],
    },
    {
        name: 'Linux 启动标识', mode: 'uuid',
        headers: ['Linux Boot ID', 'Linux Boot UUID', 'Linux Boot Identifier', 'Linux Boot Session ID'],
    },
    {
        name: 'Linux 主机名称', mode: 'template',
        headers: ['Linux Hostname', 'Linux Node Name', 'Linux Host Name', 'Linux System Hostname'],
        templates: ['{{random::linux::node::compute::host}}-{{roll::1d9999}}'],
    },
    {
        name: 'Linux 系统构建', mode: 'template',
        headers: ['Linux OS Build ID', 'Linux Image Build ID', 'Linux Distribution Build ID', 'Linux System Build ID'],
        templates: ['linux-{{roll::1d99999}}-{{random::release::stable::testing}}-{{roll::1d999}}'],
    },
    {
        name: 'Windows 系统版本', mode: 'template',
        headers: ['Windows OS Version', 'Windows NT Version', 'Windows System Version', 'Windows Kernel Version'],
        templates: ['10.0.{{roll::1d99999}}.{{roll::1d9999}}'],
    },
    {
        name: 'Windows 构建号', mode: 'template',
        headers: ['Windows Build Number', 'Windows OS Build Number', 'Windows NT Build Number', 'Windows System Build Number'],
        templates: ['{{roll::1d99999}}'],
    },
    {
        name: 'Windows 架构', mode: 'template',
        headers: ['Windows OS Architecture', 'Windows System Architecture', 'Windows Processor Architecture', 'Windows Platform Architecture'],
        templates: ['{{random::x64::ARM64::x86}}'],
    },
    {
        name: 'Windows 系统角色', mode: 'template',
        headers: ['Windows Product Role', 'Windows System Role', 'Windows OS Role', 'Windows Host Role'],
        templates: ['{{random::Workstation::DomainController::Server}}'],
    },
    {
        name: 'Windows 计算机名', mode: 'template',
        headers: ['Windows Computer Name', 'Windows CSName', 'Windows Host Name', 'Windows System Name'],
        templates: ['WIN-{{random::LAB::NODE::HOST::DESK}}-{{roll::1d9999}}'],
    },
    {
        name: 'Windows 序列标识', mode: 'template',
        headers: ['Windows OS Serial Number', 'Windows Product Serial', 'Windows System Serial', 'Windows Installation Serial'],
        templates: ['{{roll::1d99999}}-{{roll::1d999}}-{{roll::1d9999999}}-{{roll::1d99999}}'],
    },
    {
        name: 'Windows 系统目录', mode: 'template',
        headers: ['Windows Directory', 'Windows Installation Directory', 'Windows OS Directory', 'Windows Root Directory'],
        templates: ['C:\\Windows', 'D:\\Windows', 'C:\\WINNT'],
    },
];
