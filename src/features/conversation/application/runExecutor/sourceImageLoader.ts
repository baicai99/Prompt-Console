import {
  emitImageChainTrace,
  summarizeBlob,
  summarizeString,
} from '../../../../services/imageChainTrace'
import type { LoadedProviderSourceImages, SourceImageLookupInput } from './shared'
import { TRACE_FILE, TRACE_MODULE } from './shared'

export async function loadProviderSourceImages(
  input: SourceImageLookupInput,
): Promise<LoadedProviderSourceImages> {
  const providerSourceImages: LoadedProviderSourceImages['providerSourceImages'] = []
  const missingSourceImageNames: string[] = []

  for (const sourceImage of input.sourceImages) {
    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'createRun',
      stage: 'source_image_blob_lookup_started',
      traceId: input.traceId,
      runId: input.runId,
      batchId: input.batchId,
      detail: {
        sourceImageId: sourceImage.id,
        assetKey: summarizeString(sourceImage.assetKey),
        fileName: summarizeString(sourceImage.fileName),
        mimeType: sourceImage.mimeType,
        size: sourceImage.size,
      },
    })

    const blob = await input.getImageBlobFn(sourceImage.assetKey)
    if (!blob) {
      missingSourceImageNames.push(sourceImage.fileName || sourceImage.id)
      emitImageChainTrace({
        file: TRACE_FILE,
        module: TRACE_MODULE,
        fn: 'createRun',
        stage: 'source_image_blob_lookup_miss',
        level: 'warn',
        traceId: input.traceId,
        runId: input.runId,
        batchId: input.batchId,
        detail: {
          sourceImageId: sourceImage.id,
          assetKey: summarizeString(sourceImage.assetKey),
        },
      })
      continue
    }

    emitImageChainTrace({
      file: TRACE_FILE,
      module: TRACE_MODULE,
      fn: 'createRun',
      stage: 'source_image_blob_lookup_hit',
      traceId: input.traceId,
      runId: input.runId,
      batchId: input.batchId,
      detail: {
        sourceImageId: sourceImage.id,
        assetKey: summarizeString(sourceImage.assetKey),
        blob: summarizeBlob(blob),
      },
    })

    providerSourceImages.push({
      blob,
      fileName: sourceImage.fileName,
      mimeType: sourceImage.mimeType,
    })
  }

  return {
    providerSourceImages,
    missingSourceImageNames,
  }
}
