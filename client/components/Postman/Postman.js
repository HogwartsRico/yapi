import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Mock from 'mockjs'
import { Button, Input, Select, Alert, Spin, Icon, Collapse, Tooltip, message, AutoComplete, Switch } from 'antd'
import { autobind } from 'core-decorators';
import constants from '../../constants/variable.js'

import mockEditor from '../../containers/Project/Interface/InterfaceList/mockEditor'
import URL from 'url';
const MockExtra = require('common/mock-extra.js')
import './Postman.scss';
import json5 from 'json5'
import { handleMockWord } from '../../common.js'

function json_parse(data) {
  try {
    return json5.parse(data)
  } catch (e) {
    return data
  }
}

function isJsonData(headers) {
  if (!headers || typeof headers !== 'object') return false;
  let isResJson = false;
  Object.keys(headers).map(key => {
    if (/content-type/i.test(key) && /application\/json/i.test(headers[key])) {
      isResJson = true;
    }
  })
  return isResJson;
}

const wordList = constants.MOCK_SOURCE;

const mockDataSource = wordList.map(item => {
  return <AutoComplete.Option key={item.mock} value={item.mock}>
    {item.mock}&nbsp; &nbsp;随机{item.name}
  </AutoComplete.Option>
});


// const { TextArea } = Input;
const InputGroup = Input.Group;
const Option = Select.Option;
const Panel = Collapse.Panel;

const HTTP_METHOD = constants.HTTP_METHOD;

export default class Run extends Component {

  static propTypes = {
    data: PropTypes.object,
    save: PropTypes.func,
    saveTip: PropTypes.string,
    type: PropTypes.string
  }

  state = {
    res: null,
    resHeader: null,
    method: 'GET',
    domains: [],
    pathname: '',
    query: [],
    bodyForm: [],
    headers: [],
    caseEnv: '',
    bodyType: '',
    bodyOther: '',
    loading: false,
    validRes: [],
    hasPlugin: true,
    test_status: null,
    resMockTest: true,
    resStatusCode: null,
    resStatusText: ''
  }

  constructor(props) {
    super(props)
  }

  componentWillMount() {
    let startTime = 0;
    this.interval = setInterval(() => {
      startTime += 500;
      if (startTime > 5000) {
        clearInterval(this.interval);
      }
      if (window.crossRequest) {
        clearInterval(this.interval);
        this.setState({
          hasPlugin: true
        })
      } else {
        this.setState({
          hasPlugin: false
        })
      }
    }, 500)
    this.getInterfaceState()
  }

  componentWillUnmount() {
    clearInterval(this.interval)
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.data._id !== this.props.data._id) {
      this.getInterfaceState(nextProps)
    }
  }

  componentDidMount() {
    const { bodyType } = this.state;
    if (bodyType && bodyType !== 'file' && bodyType !== 'form') {
      this.loadBodyEditor()
    }
  }

  @autobind
  getInterfaceState(nextProps) {
    const props = nextProps || this.props;
    const { data, type } = props;
    const {
      method = '',
      path: url = '',
      req_headers = [],
      req_body_type,
      req_query = [],
      req_params = [],
      req_body_other = '',
      req_body_form = [],
      basepath = '',
      env = [],
      case_env = '',
      test_status = '',
      test_res_body = '',
      test_report = [],
      test_res_header = '',
      mock_verify = true
    } = data;

    // case 任意编辑 pathname，不管项目的 basepath
    const pathname = (type === 'inter' ? (basepath + url) : url).replace(/\/+/g, '/');

    // let hasContentType = false;
    // req_headers.forEach(headerItem => {
    //   // TODO 'Content-Type' 排除大小写不同格式影响
    //   if (headerItem.name === 'Content-Type'){
    //     hasContentType = true;
    //     headerItem.value = headerItem.value || 'application/x-www-form-urlencoded';
    //   }
    // })
    // if (!hasContentType) {
    //   req_headers.push({name: 'Content-Type', value: 'application/x-www-form-urlencoded'});
    // }
    // const domains = env.concat();
    // if (domain && !env.find(item => item.domain === domain)) {
    //   domains.push({name: 'default', domain})
    // }

    this.setState({
      method,
      domains: env.concat(),
      pathParam: req_params.concat(),
      pathname,
      query: req_query.concat(),
      bodyForm: req_body_form.concat(),
      headers: req_headers.concat(),
      bodyOther: req_body_other,
      caseEnv: case_env || (env[0] && env[0].name),
      bodyType: req_body_type || 'form',
      loading: false,
      test_status: test_status,
      validRes: test_report,
      res: test_res_body,
      resHeader: test_res_header,
      resMockTest: mock_verify
    }, () => {
      if (req_body_type && req_body_type !== 'file' && req_body_type !== 'form') {
        this.loadBodyEditor()
      }
      if (test_res_body) {
        this.bindAceEditor();
      }

    });

  }

  @autobind
  reqRealInterface() {
    if (this.state.loading) {
      this.setState({ loading: false })
      return;
    }
    const { headers, bodyForm, pathParam, bodyOther, caseEnv, domains, method, pathname, query, bodyType } = this.state;
    const urlObj = URL.parse(domains.find(item => item.name === caseEnv).domain);
    let path = pathname
    pathParam.forEach(item => {
      path = path.replace(`:${item.name}`, item.value || `:${item.name}`);
    });
    if(urlObj.pathname){
      if(urlObj.pathname[urlObj.pathname.length - 1] !== '/'){
        urlObj.pathname += '/'
      }
    }

    const href = URL.format({
      protocol: urlObj.protocol || 'http',
      host: urlObj.host,
      pathname: urlObj.pathname ? URL.resolve(urlObj.pathname, '.' + path) : path,
      query: this.getQueryObj(query)
    });

    this.setState({ loading: true })
    let that = this;
    window.crossRequest({
      url: href,
      method,
      headers: this.getHeadersObj(headers),
      data: bodyType === 'form' ? this.arrToObj(bodyForm) : bodyOther,
      files: bodyType === 'form' ? this.getFiles(bodyForm) : {},
      file: bodyType === 'file' ? 'single-file' : null,
      success: (res, header, third) => {
        console.log('suc', third);
        this.setState({
          resStatusCode: third.res.status,
          resStatusText: third.res.statusText
        })
        try {
          if (isJsonData(header)) {
            res = json_parse(res);
          }

          const { res_body, res_body_type } = that.props.data;
          let validRes = [];
          let query = {};
          that.state.query.forEach(item => {
            query[item.name] = item.value;
          })
          let body = {};
          if (that.state.bodyType === 'form') {
            that.state.bodyForm.forEach(item => {
              body[item.name] = item.value;
            })
          } else if (that.state.bodyType === 'json') {
            body = json_parse(that.state.bodyOther);
          }
          if (res_body && res_body_type === 'json' && typeof res === 'object') {
            let tpl = MockExtra(json_parse(res_body), {
              query: query,
              body: body
            })
            validRes = Mock.valid(tpl, res)
          }


          if (Array.isArray(validRes) && validRes.length > 0) {
            message.warn('请求完成, 返回数据跟接口定义不匹配');
            validRes = validRes.map(item => {
              return item.message
            })
            that.setState({ res, resHeader: header, validRes, test_status: 'invalid' })
          } else if (Array.isArray(validRes) && validRes.length === 0) {
            message.success('请求完成');
            that.setState({ res, resHeader: header, validRes: ['验证通过'], test_status: 'ok' })
          }
          that.setState({ loading: false })
          that.bindAceEditor()
        } catch (e) {
          console.error(e.message)
        }
      },
      error: (err, header, third) => {
        console.log('err', third);
        this.setState({
          resStatusCode: third.res.status,
          resStatusText: third.res.statusText
        })
        try {
          err = json_parse(err);
        } catch (e) {
          console.log(e)
        }
        message.error(err || '请求异常')
        that.setState({ res: err || '请求失败', resHeader: header, validRes: [], test_status: 'error' })
        that.setState({ loading: false })
        that.bindAceEditor()
      }
    })
  }

  // @autobind
  // changeDomain(value) {
  //   this.setState({ currDomain: value });
  // }

  @autobind
  selectDomain(value) {
    this.setState({ caseEnv: value });
  }

  @autobind
  changeHeader(v, index, isName) {
    const headers = json_parse(JSON.stringify(this.state.headers));
    if (isName) {
      headers[index].name = v;
    } else {
      headers[index].value = v;
    }
    this.setState({ headers });
  }
  @autobind
  addHeader() {
    const { headers } = this.state;
    this.setState({ headers: headers.concat([{ name: '', value: '' }]) })
  }
  @autobind
  deleteHeader(index) {
    const { headers } = this.state;
    this.setState({ headers: headers.filter((item, i) => +index !== +i) });
  }
  @autobind
  setContentType() {
    // const headersObj = this.getHeadersObj(this.state.headers);
    // headersObj['Content-Type'] = type;
    // this.setState({ headers: this.objToArr(headersObj) })
  }

  @autobind
  changeQuery(v, index, isKey) {
    const query = json_parse(JSON.stringify(this.state.query));
    if (isKey) {
      query[index].name = v;
    } else {
      query[index].value = v;
    }
    this.setState({ query });
  }
  @autobind
  addQuery() {
    const { query } = this.state;
    this.setState({ query: query.concat([{ name: '', value: '' }]) })
  }
  @autobind
  deleteQuery(index) {
    const { query } = this.state;
    this.setState({ query: query.filter((item, i) => +index !== +i) });
  }

  @autobind
  changePathParam(v, index, isKey) {
    const pathParam = JSON.parse(JSON.stringify(this.state.pathParam));
    const name = pathParam[index].name;
    let newPathname = this.state.pathname;
    if (isKey) {
      if (!name && v) {
        newPathname += `/:${v}`;
      } else {
        newPathname = newPathname.replace(`/:${name}`, v ? `/:${v}` : '')
      }
      pathParam[index].name = v;
    } else {
      pathParam[index].value = v;
    }
    this.setState({ pathParam, pathname: newPathname });
  }
  @autobind
  addPathParam() {
    const { pathParam } = this.state;
    this.setState({ pathParam: pathParam.concat([{ name: '', value: '' }]) })
  }
  @autobind
  deletePathParam(index) {
    const { pathParam } = this.state;
    const name = pathParam[index].name;
    const newPathname = this.state.pathname.replace(`/:${name}`, '');
    this.setState({ pathParam: pathParam.filter((item, i) => +index !== +i), pathname: newPathname });
  }

  @autobind
  changeBody(v, index) {
    const bodyForm = json_parse(JSON.stringify(this.state.bodyForm));
    if (bodyForm[index].type === 'file') {
      bodyForm[index].value = 'file_' + index
    } else {
      bodyForm[index].value = v
    }
    this.setState({ bodyForm });
  }
  @autobind
  addBody() {
    const { bodyForm } = this.state;
    this.setState({ bodyForm: bodyForm.concat([{ name: '', value: '', type: 'text' }]) })
  }
  @autobind
  deleteBody(index) {
    const { bodyForm } = this.state;
    this.setState({ bodyForm: bodyForm.filter((item, i) => +index !== +i) });
  }

  @autobind
  changeMethod(value) {
    this.setState({ method: value });
  }

  @autobind
  changePath(e) {
    const path = e.target.value;
    const urlObj = URL.parse(path, true);
    this.setState({
      query: this.objToArr(urlObj.query),
      pathname: urlObj.pathname
    })
  }

  @autobind
  changeBodyType(value) {
    this.setState({ bodyType: value }, () => {
      if (value !== 'file' && value !== 'form') {
        this.loadBodyEditor()
      }
    })
  }

  // hasCrossRequestPlugin() {
  //   const dom = document.getElementById('y-request');
  //   return dom.getAttribute('key') === 'yapi';
  // }

  objToArr(obj, key, value) {
    const keyName = key || 'name';
    const valueName = value || 'value';
    const arr = []
    Object.keys(obj).forEach((_key) => {
      if (_key) {
        arr.push({ [keyName]: _key, [valueName]: obj[_key] });
      }
    })
    return arr;
  }
  arrToObj(arr) {
    const obj = {};
    arr.forEach(item => {
      if (item.name && item.type !== 'file') {
        obj[item.name] = handleMockWord(item.value);
      }
    })
    return obj;
  }

  getFiles(bodyForm) {
    const files = {};
    bodyForm.forEach(item => {
      if (item.name && item.type === 'file') {
        files[item.name] = item.value
      }
    })
    return files;
  }
  getQueryObj(query) {
    const queryObj = {};
    query.forEach(item => {
      if (item.name) {
        queryObj[item.name] = handleMockWord(item.value);
      }
    })
    return queryObj;
  }
  getHeadersObj(headers) {
    const headersObj = {};
    headers.forEach(item => {
      if (item.name && item.value) {
        headersObj[item.name] = item.value;
      }
    })
    return headersObj;
  }

  bindAceEditor = () => {
    mockEditor({
      container: 'res-body-pretty',
      data: this.state.res,
      readOnly: true,
      onChange: function () { }
    })
    

    mockEditor({
      container: 'res-headers-pretty',
      data: this.state.resHeader,
      readOnly: true,
      onChange: function () { }
    })
  }
  loadBodyEditor = () => {
    const that = this;
    setTimeout(function () {
      mockEditor({
        container: 'body-other-edit',
        data: that.state.bodyOther,
        onChange: function (d) {
          if (d.format !== true) return false;
          that.setState({
            bodyOther: d.text
          })
        }
      })
    }, 0);
  }

  @autobind
  fileChange(e, index) {
    console.log(e)
    console.log(index)
  }

  @autobind
  onTestSwitched(checked) {
    this.setState({
      resMockTest: checked
    });
  }

  render() {
    const { method, domains, pathParam, pathname, query, headers, bodyForm, caseEnv, bodyType, resHeader, loading, validRes } = this.state;
    HTTP_METHOD[method] = HTTP_METHOD[method] || {}
    const hasPlugin = this.state.hasPlugin;
    let isResJson = isJsonData(resHeader);
    let path = pathname;
    pathParam.forEach(item => {
      path = path.replace(`:${item.name}`, item.value || `:${item.name}`);
    });
    const search = decodeURIComponent(URL.format({ query: this.getQueryObj(query) }));

    let validResView;
    validResView = validRes.map((item, index) => {
      return <div key={index}>{item}</div>
    })




    return (
      <div className="interface-test postman">
        <div className={hasPlugin ? null : 'has-plugin'} >
          {hasPlugin ? '' : <Alert
            message={
              <div>
                {/* 温馨提示：当前正在使用接口测试服务，请安装我们为您免费提供的测试增强插件&nbsp;（该插件可支持任何 chrome 内核的浏览器） */}
                重要：当前的接口测试服务，需安装免费测试增强插件 （支持所有 webkit 内核），选择下面任意一种安装方式：
                <div>
                  <a
                    target="blank"
                    href="https://chrome.google.com/webstore/detail/cross-request/cmnlfmgbjmaciiopcgodlhpiklaghbok?hl=en-US"
                  > [Google 商店获取（需翻墙）]</a>
                </div>
                <div>
                  <a
                    target="blank"
                    href="/api/interface/download_crx"
                  > [手动下载] </a>
                  <span> zip 文件解压后将 crx 文件拖入到 chrome://extensions/ </span>
                  <a
                    target="blank"
                    href="http://www.jianshu.com/p/12ca04c61fc6"
                  > [详细安装教程] </a>
                </div>
              </div>
            }
            type="warning"
          />
          }
        </div>


        <h2 className="interface-title" style={{ marginTop: 0 }}>请求部分&nbsp;
          <Tooltip placement="top" title="在 '设置->环境配置' 配置 domain"><Icon type="question-circle-o" /></Tooltip>
        </h2>
        <div className="url">

          <InputGroup compact style={{ display: 'flex' }}>
            <Select disabled value={method} style={{ flexBasis: 60 }} onChange={this.changeMethod} >
              <Option value="GET">GET</Option>
              <Option value="POST">POST</Option>
            </Select>

            <Select value={caseEnv} style={{ flexBasis: 180, flexGrow: 1 }} onSelect={this.selectDomain}>
              {
                domains.map((item, index) => (<Option value={item.name} key={index}>{item.name + '：' + item.domain}</Option>))
              }
            </Select>

            <Input disabled value={path + search} onChange={this.changePath} spellCheck="false" style={{ flexBasis: 180, flexGrow: 1 }} />
          </InputGroup>

          <Tooltip placement="bottom" title={(() => {
            if (hasPlugin) {
              return '发送请求'
            } else {
              return '请安装cross-request插件'
            }
          })()}>
            <Button
              disabled={!hasPlugin}
              onClick={this.reqRealInterface}
              type="primary"
              style={{ marginLeft: 10 }}
              icon={loading ? 'loading' : ''}
            >{loading ? '取消' : '发送'}</Button>
          </Tooltip>
          <Tooltip placement="bottom" title={this.props.saveTip}>
            <Button
              onClick={this.props.save}
              type="primary"
              style={{ marginLeft: 10 }}
            >{this.props.type === 'inter' ? '保存' : '保存'}</Button>
          </Tooltip>
        </div>

        <Collapse defaultActiveKey={['0', '1', '2', '3']} bordered={true}>
          <Panel header="PATH PARAMETERS" key="0" className={pathParam.length === 0 ? 'hidden' : ''}>
            {
              pathParam.map((item, index) => {
                return (
                  <div key={index} className="key-value-wrap">
                    <Input disabled value={item.name} onChange={e => this.changePathParam(e, index, true)} className="key" />
                    <span className="eq-symbol">=</span>
                    <AutoComplete
                      value={item.value}
                      onChange={e => this.changePathParam(e, index)}
                      className="value"
                      dataSource={mockDataSource}
                      placeholder="参数值"
                      optionLabelProp="value"
                    />
                    <Icon style={{ display: 'none' }} type="delete" className="icon-btn" onClick={() => this.deletePathParam(index)} />
                  </div>
                )
              })
            }
            <Button style={{ display: 'none' }} type="primary" icon="plus" onClick={this.addPathParam}>添加Path参数</Button>
          </Panel>
          <Panel header="QUERY PARAMETERS" key="1" className={query.length === 0 ? 'hidden' : ''}>
            {
              query.map((item, index) => {
                return (
                  <div key={index} className="key-value-wrap">
                    <Input disabled value={item.name} onChange={e => this.changeQuery(e, index, true)} className="key" />
                    <span className="eq-symbol">=</span>
                    <AutoComplete
                      value={item.value}
                      onChange={e => this.changeQuery(e, index)}
                      className="value"
                      dataSource={mockDataSource}
                      placeholder="参数值"
                      optionLabelProp="value"
                    />
                    <Icon style={{ display: 'none' }} type="delete" className="icon-btn" onClick={() => this.deleteQuery(index)} />
                  </div>
                )
              })
            }
            <Button style={{ display: 'none' }} type="primary" icon="plus" onClick={this.addQuery}>添加Query参数</Button>
          </Panel>
          <Panel header="HEADERS" key="2" className={headers.length === 0 ? 'hidden' : ''}>
            {
              headers.map((item, index) => {
                return (
                  <div key={index} className="key-value-wrap">
                    <Input disabled value={item.name} onChange={e => this.changeHeader(e, index, true)} className="key" />
                    <span className="eq-symbol">=</span>
                    <AutoComplete
                      value={item.value}
                      onChange={e => this.changeHeader(e, index)}
                      className="value"
                      dataSource={mockDataSource}
                      placeholder="参数值"
                      optionLabelProp="value"
                    />
                    <Icon style={{ display: 'none' }} type="delete" className="icon-btn" onClick={() => this.deleteHeader(index)} />
                  </div>
                )
              })
            }
            <Button style={{ display: 'none' }} type="primary" icon="plus" onClick={this.addHeader}>添加Header</Button>
          </Panel>
          <Panel
            header={
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>BODY</div>
              </div>
            }
            key="3"
            className={HTTP_METHOD[method].request_body ? 'POST' : 'hidden'}
          >

            <div style={{ display: HTTP_METHOD[method].request_body && bodyType !== 'form' && bodyType !== 'file' ? 'block' : 'none' }}>
              <div id="body-other-edit" style={{ marginTop: 10, minHeight: 150 }} className="pretty-editor"></div>
            </div>

            {
              HTTP_METHOD[method].request_body && bodyType === 'form' &&
              <div>
                {
                  bodyForm.map((item, index) => {
                    return (
                      <div key={index} className="key-value-wrap">
                        <Input disabled value={item.name} onChange={e => this.changeBody(e, index, 'key')} className="key" />
                        <span>[</span>
                        <Select disabled value={item.type} onChange={e => this.changeBody(e, index, 'type')}>
                          <Option value="file">File</Option>
                          <Option value="text">Text</Option>
                        </Select>
                        <span>]</span>
                        <span className="eq-symbol">=</span>
                        {item.type === 'file' ?
                          <Input type="file" id={'file_' + index} onChange={e => this.changeBody(e, index, 'value')} multiple className="value" /> :
                          <AutoComplete
                            value={item.value}
                            onChange={e => this.changeBody(e, index, 'value')}
                            className="value"
                            dataSource={mockDataSource}
                            placeholder="参数值"
                            optionLabelProp="value"
                          />

                        }
                        <Icon style={{ display: 'none' }} type="delete" className="icon-btn" onClick={() => this.deleteBody(index)} />
                      </div>
                    )
                  })
                }
                <Button style={{ display: 'none' }} type="primary" icon="plus" onClick={this.addBody}>添加Form参数</Button>
              </div>
            }
            {
              HTTP_METHOD[method].request_body && bodyType === 'file' &&
              <div>
                <Input type="file" id="single-file"></Input>
              </div>
            }
            {/*
              method !== 'POST' &&
              <div>GET 请求没有 BODY。</div>
            */}
          </Panel>
        </Collapse>

        <h2 className="interface-title">返回结果</h2>

        <Spin  spinning={this.state.loading}>
          <h2 style={{ display: this.state.resStatusCode !== null ? '' : 'none' }}  className={'res-code ' + ((this.state.resStatusCode >= 200 && this.state.resStatusCode < 400 && !this.state.loading) ? 'success' : 'fail')}>{this.state.resStatusCode + '  ' + this.state.resStatusText}</h2>

          <div style={{ display: this.state.res ? '' : 'none' }}  className="container-header-body">
            <div className="header">
              <div className="container-title">
                <h4>Headers</h4>
              </div>
              <div id="res-headers-pretty" className="pretty-editor-header"></div>
            </div>
            <div className="resizer">
              <div className="container-title">
                <h4 style={{ visibility: 'hidden' }}>1</h4>
              </div>
            </div>
            <div className="body">
              <div className="container-title">
                <h4>Body</h4>
              </div>
              <div id="res-body-pretty" className="pretty-editor-body" style={{ display: isResJson ? '' : 'none' }}></div>
              <div
                style={{ display: isResJson ? 'none' : '' }}
                className="res-body-text"
              >{this.state.res && this.state.res.toString()}</div>
            </div>
          </div>
        </Spin>

        <p style={{ display: this.state.resStatusCode===null ? '' : 'none' }}>发送请求后在这里查看返回结果。</p>

        <h2 className="interface-title">数据结构验证
          <Switch style={{ verticalAlign: 'text-bottom', marginLeft: '8px' }} checked={this.state.resMockTest} onChange={this.onTestSwitched} />
        </h2>
        <div className={(isResJson && this.state.resMockTest) ? '' : 'none'}>
          {(isResJson && this.state.resMockTest) ? validResView : <div><p>若开启此功能，则发送请求后在这里查看验证结果。</p><p>数据结构验证在接口编辑页面配置，YApi 将根据 Response body 验证请求返回的结果。</p></div>}
        </div>
      </div>
    )
  }
}
