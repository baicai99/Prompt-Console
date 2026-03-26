import type { ReactNode } from 'react'
import {
  AppstoreOutlined,
  BarChartOutlined,
  BugOutlined,
  CodeOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  PictureOutlined,
  SettingOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { APP_ROUTES } from '../../../../../routes'

export type RightPanelTab = 'modelPicker' | 'settings' | 'modelStats' | 'imageParams' | 'dynamicPrompt' | 'advanced' | 'diagnostics'

export const MODEL_PICKER_EMPTY_TEXT = '当前没有可用模型，请先配置渠道并刷新模型列表'

export const ANALYTICS_ENTRY_CARDS = [
  {
    key: 'models',
    title: '模型分析',
    actionLabel: '进入模型分析',
    actionRoute: APP_ROUTES.modelStats,
    icon: <BarChartOutlined />,
  },
  {
    key: 'logs',
    title: '运行日志',
    actionLabel: '进入日志页',
    actionRoute: APP_ROUTES.logs,
    icon: <FileSearchOutlined />,
  },
  {
    key: 'storage',
    title: '本地存储',
    actionLabel: '进入本地存储仪表盘',
    actionRoute: APP_ROUTES.storage,
    icon: <DatabaseOutlined />,
  },
] as const

export function resolveRightPanelItems(activeSideMode: 'single' | 'multi') {
  return [
    {
      key: 'modelPicker',
      title: activeSideMode === 'multi' ? '默认模型' : '模型管理',
      icon: <AppstoreOutlined />,
      ariaLabel: activeSideMode === 'multi' ? '打开默认模型' : '打开模型管理',
    },
    {
      key: 'imageParams',
      title: '生图参数',
      icon: <PictureOutlined />,
      ariaLabel: '打开生图参数',
    },
    {
      key: 'dynamicPrompt',
      title: '动态提示词',
      icon: <CodeOutlined />,
      ariaLabel: '打开动态提示词',
    },
    {
      key: 'settings',
      title: '设置',
      icon: <SettingOutlined />,
      ariaLabel: '打开设置',
    },
    {
      key: 'modelStats',
      title: '运行分析',
      icon: <BarChartOutlined />,
      ariaLabel: '打开运行分析',
    },
    {
      key: 'advanced',
      title: '高级功能',
      icon: <ToolOutlined />,
      ariaLabel: '打开高级功能',
    },
    {
      key: 'diagnostics',
      title: '内存诊断',
      icon: <BugOutlined />,
      ariaLabel: '打开内存诊断',
    },
  ] as const satisfies ReadonlyArray<{
    key: RightPanelTab
    title: string
    icon: ReactNode
    ariaLabel: string
  }>
}
