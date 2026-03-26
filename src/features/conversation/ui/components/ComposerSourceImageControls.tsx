import type { RefObject } from 'react'
import { DeleteOutlined } from '@ant-design/icons'
import { Button } from 'antd'

interface ComposerSourceImageControlsProps {
  sourceImageInputRef: RefObject<HTMLInputElement | null>
  sourceImages: Array<{ id: string; file: File; previewUrl: string }>
  sourceImagesEnabled: boolean
  onSourceImagesAppend: (files: File[]) => void
  onSourceImageRemove: (id: string) => void
}

export function ComposerSourceImageControls(props: ComposerSourceImageControlsProps) {
  const {
    sourceImageInputRef,
    sourceImages,
    sourceImagesEnabled,
    onSourceImagesAppend,
    onSourceImageRemove,
  } = props

  return (
    <>
      <input
        ref={sourceImageInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="composer-source-image-input hidden"
        disabled={!sourceImagesEnabled}
        onChange={(event) => {
          if (!sourceImagesEnabled) {
            return
          }
          const fileList = event.target.files
          if (!fileList || fileList.length === 0) {
            return
          }
          onSourceImagesAppend(Array.from(fileList))
          event.currentTarget.value = ''
        }}
      />
      {sourceImages.length > 0 ? (
        <div className="composer-source-image-panel m-0">
          <div className="composer-source-image-list flex gap-2.5 overflow-x-auto p-0" aria-label="参考图列表">
            {sourceImages.map((item) => (
              <div key={item.id} className="composer-source-image-item relative h-28 w-28 min-w-28 overflow-hidden rounded-lg border border-[rgba(214,220,229,0.92)] bg-[#f4f4f4]">
                <img src={item.previewUrl} alt={item.file.name || '参考图'} className="composer-source-image-thumb block h-full w-full object-cover" />
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  className="composer-source-image-remove-btn !absolute !top-2 !right-2 !inline-flex !h-7 !w-7 !min-w-7 !items-center !justify-center !rounded-full !border-none !bg-[rgba(0,0,0,0.56)] !text-white hover:!bg-[rgba(0,0,0,0.72)] hover:!text-white focus:!bg-[rgba(0,0,0,0.72)] focus:!text-white active:!bg-[rgba(0,0,0,0.72)] active:!text-white"
                  onClick={() => onSourceImageRemove(item.id)}
                  aria-label={`删除参考图 ${item.file.name || ''}`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
