# 静默截图和OCR功能使用说明

本项目新增了使用静默截图和OCR技术获取打印机墨粉数据的功能。

## 功能原理

1. 使用Puppeteer（无头Chrome浏览器）静默打开打印机管理页面
2. 对页面进行截图
3. 使用Tesseract.js对截图进行OCR文字识别
4. 从识别的文本中解析出墨粉余量数据
5. 返回解析结果

## 新增API端点

### 1. 获取单台打印机的墨粉数据（使用静默截图和OCR）

```
GET /api/printers/scrape/printer/:ip/toner/screenshot
```

#### 参数：
- `ip`：打印机的IP地址（URL参数）

#### 响应示例：
```json
{
  "success": true,
  "data": {
    "black": 47,
    "cyan": 91,
    "magenta": 13,
    "yellow": 75
  },
  "source": "screenshot_ocr",
  "timestamp": "2023-12-01T12:34:56Z"
}
```

#### 错误响应示例：
```json
{
  "success": false,
  "error": "Failed to take screenshot: Error message",
  "timestamp": "2023-12-01T12:34:56Z"
}
```

## 安装依赖

```bash
cd backend
npm install
```

## 测试方法

运行以下命令测试静默截图和OCR功能：

```bash
cd backend
node testScreenshotOcr.js
```

## 注意事项

1. 确保后端服务器运行在`http://localhost:3001`
2. 确保目标打印机可以从服务器访问
3. 部分打印机可能需要身份验证，目前该功能不支持有密码保护的打印机页面
4. OCR识别精度取决于打印机页面的布局和清晰度
5. 首次使用Tesseract.js时会下载OCR模型，可能需要一些时间

## 日志记录

所有的截图和OCR操作都会记录详细的日志到控制台，包括：
- 访问的打印机URL
- 截图保存路径
- OCR处理进度
- 识别结果和解析的数据