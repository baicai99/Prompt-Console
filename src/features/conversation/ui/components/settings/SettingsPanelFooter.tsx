import { GithubOutlined } from '@ant-design/icons'
import { Button, Typography } from 'antd'

const { Text } = Typography

interface SettingsPanelFooterProps {
  githubRepoUrl: string
}

export function SettingsPanelFooter(props: SettingsPanelFooterProps) {
  return (
    <div className="mt-5 flex flex-col items-center gap-1 pb-3">
      <Text type="secondary" className="text-xs leading-none">
        v{__APP_VERSION__}
      </Text>
      <Button
        type="text"
        className="!h-7 !w-7 !min-w-7 !text-[rgba(15,23,42,0.45)] hover:!text-[rgba(15,23,42,0.75)]"
        icon={<GithubOutlined />}
        href={props.githubRepoUrl}
        target="_blank"
        rel="noreferrer"
        title="GitHub"
        aria-label="GitHub"
      />
    </div>
  )
}
