import {Context, h, Schema} from 'koishi'
import {} from 'http'

export const name = 'get-random-pig'

// zhu为默认触发词
const defaultCommand: string[] = ["祝", "猪", "好多猪", "好多祝", "🐖", "㊗️"];

export interface Config {
 pig?: string[]
}
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    help: Schema.boolean().default(false).description(`
# 插件使用说明

- 接上[PigHub](https://pighub.top)的随机猪猪群友图片插件

- 在群里有人发送你设置的猪猪触发词时返回一个随机猪猪！！！

- 有时间再写个搜索猪猪图片的功能
    `).role('label')
  }).description('使用说明'),

  Schema.object({
    pig: Schema.array(
      Schema.string()
        .required()
    )
        .description('好多猪')
        .role('table')
        .default(defaultCommand)
    })
      .role("table")
      .description("猪猪的触发词")
  ])

export const inject = {
  required: ['http'],
}

// PigHub的图片json
interface ImageJson {
  "id": string,
  "thumbnail": string,
  "mtime": number,
  "duration": string,
  "filename": string,
  "download_count": number,
  "title": string,
  "image_type": string,
  "view_count": number,
}

interface ImageCache {
  images: ImageJson[],
  ids: string[],
  lastUpdated: Date
}

let imageCache : ImageCache = {
  images: [],
  ids: [],
  lastUpdated: null
};

const isCacheEmpty = () => {
  return imageCache.images.length === 0;
};

const getRandomImage = () => {
  if (isCacheEmpty()) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * imageCache.images.length);
  return imageCache.images[randomIndex];
};

let intervalId = null;




export function apply(ctx: Context, config: Config) {
  // write your plugin here

  const getAllImages = async () => {
    try {


      const response = await ctx.http.get(
        `https://pighub.top/api/all-images`
      );

      if (response && response.total > 0) {
        imageCache = {
          images: response.images,
          ids: response.images.map(i => i.id),
          lastUpdated: new Date()
        };
        return true;
      } else {
        return false;
      }
    }catch (e){
      ctx.logger("pig-getRandomImage").error(`PigHub访问失败了...\n${e}`);
      return false;
    }
  };


  const startCacheUpdateInterval = () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    // 24小时 = 24 * 60 * 60 * 1000 = 86400000 毫秒
    intervalId = setInterval(async () => {
      await getAllImages();
      ctx.logger("pig-update").info(`${new Date().toISOString()} 更新了哦`)
    }, 24 * 60 * 60 * 1000);

  };



  async function getImage() {
    if (isCacheEmpty()) {
      const success = await getAllImages();
      if (!success) {
        return "🐖迷路了";
      }
    }
    const randomImage = getRandomImage();
    if (!randomImage) {
      return "没有🐖了";
    }

    const picName = randomImage.thumbnail;


    return h('img', {
      src: `https://pighub.top${picName}`
    })
  }

  let pigName = config.pig || ["zhu"]
  ctx.on("ready", ()=>{
    startCacheUpdateInterval();
  })

  ctx.on("dispose", ()=>{
    clearInterval(intervalId);
  })

  ctx.on("message", async (session) => {
  })

  ctx.middleware(async (session, next) => {
    if (pigName.includes(session.content)) {
      return await getImage();
    } else return next();
  }, true);

}
